// Laboratori de paraules (des del 7/11): quatre maneres d'aprendre una paraula, comparades amb paraules diferents.
// Primer dia, dictat sense correcció; després, cada dia: frases (si toca), les vistes de memòria, una nova de cada manera,
// les noves un altre cop de memòria i el repàs amb calma de les frases.
const { test, expect, URL_APP, simularSupabase } = require('./ayudas');

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+|malament|incorrect/i;
const PLAN_ACABAT = [1, 2, 3, 4, 5, 6].map(id => ({ id, fecha: '2026-01-01' })).concat([{ id: 10, fecha: '2026-10-17' }]);
const EXTRES_FETES = [{ id: 102, fecha: '2026-10-16' }, { id: 103, fecha: '2026-10-17' }];

async function preparar(page, dia, { plan = {}, lab = null } = {}) {
    const { envios } = await simularSupabase(page, { lab: true });
    await page.clock.setFixedTime(new Date(`${dia}T17:00:00`));
    await page.addInitScript(([p, st]) => {
        if (sessionStorage.getItem('plan-preparado')) return;
        sessionStorage.setItem('plan-preparado', '1');
        localStorage.setItem('dojo_plan', JSON.stringify(p));
        if (st) localStorage.setItem('dojo_lab', JSON.stringify(st));
    }, [{ hechas: PLAN_ACABAT, extras: EXTRES_FETES, ...plan }, lab]);
    await page.goto(URL_APP);
    return envios;
}

async function escriure(page, text) {
    for (const c of text) await page.click(`#teclat-lletres [data-tecla="${c}"]`);
}
const actual = page => page.evaluate(() => window.__labActual());
const ara = async page => JSON.stringify(await actual(page));
async function seguent(page, anterior) {
    await expect.poll(async () => JSON.stringify(await actual(page))).not.toBe(anterior);
    return actual(page);
}
async function escriureIFet(page, text) {
    await expect(page.locator('#dictat-panel')).toBeVisible();
    await expect(page.locator('#lab-panel')).toBeHidden();
    await escriure(page, text);
    await page.click('#btn-dictat-fet');
}
/** Una d'aprendre (mira, trampa, germana, trossos): la mira o posa les lletres que falten, i la tapa */
async function aprendre(page) {
    const p = await actual(page);
    await expect(page.locator('#lab-panel')).toBeVisible();
    if (['trampa', 'germana'].includes(p.etapa)) {
        for (const lletra of p.forats) {
            await expect(page.locator('#lab-opcions')).toBeVisible();
            await page.click(`#lab-opcions [data-lletra="${lletra}"]`);
        }
    }
    await page.click('#btn-lab-seguir');
    return p;
}

const ESTAT_REPARTIT = (assig, w = {}, extra = {}) => ({ prova: { data: '2026-11-07', ok: {} }, assig, w, fet: '2026-11-07', ...extra });

test.describe('Laboratori de paraules', () => {
    test('el 7/11, al final de la missió: dictat de totes sense correcció; les que no surten es reparteixen entre les 4 maneres', async ({ page }) => {
        const envios = await preparar(page, '2026-11-07');
        await expect(page.locator('#mision-pasos li').last()).toHaveText('🧪 Laboratori de paraules');
        // Directe al laboratori (els blocs de l'entrenament ja fets avui)
        await page.evaluate(() => {
            const p = JSON.parse(localStorage.getItem('dojo_plan'));
            p.enCurso = { id: 10, bloque: 2, fecha: '2026-11-07' };
            localStorage.setItem('dojo_plan', JSON.stringify(p));
        });
        await page.reload();
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Laboratori de paraules');
        await expect(page.locator('#intro-texto')).toContainText('sense correcció');
        await page.click('#btn-intro-vamos');

        const totes = await page.evaluate(() => window.__labParaules());
        expect(totes).toHaveLength(16);
        const bones = ['podem', 'joven', 'entrem', 'història'];
        let anterior = 'null';
        for (let i = 0; i < 16; i++) {
            const p = await seguent(page, anterior);
            expect(p).toMatchObject({ fase: 'prova', etapa: 'escriu', metode: null });
            await expect(page.locator('#btn-no-ho-se')).toBeVisible();
            if (p.paraula === 'cohesión') await page.click('#btn-no-ho-se');
            else await escriureIFet(page, bones.includes(p.paraula) ? p.paraula : p.paraula.slice(0, -1));
            // Sense correcció: no es veu la bona
            await expect(page.locator('#gentle-correction-box')).toBeHidden();
            anterior = await ara(page);
        }
        // Al final, totes ben escrites
        await expect(page.locator('#screen-repas')).toBeVisible();
        await expect(page.locator('#repas-llista li')).toHaveCount(16);
        await expect(page.locator('#repas-llista li').first().locator('.clau').first()).toBeVisible();
        await page.click('#btn-repas-seguim');
        await expect(page.locator('#screen-summary')).toBeVisible();
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');

        const st = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_lab')));
        expect(st.fet).toBe('2026-11-07');
        expect(st.prova.data).toBe('2026-11-07');
        expect(Object.keys(st.assig)).toHaveLength(12);
        for (const id of ['ca-podem', 'es-joven', 'ca-entrem', 'ca-historia']) expect(st.assig[id]).toBeUndefined();
        const perManera = {};
        Object.values(st.assig).forEach(m => { perManera[m] = (perManera[m] || 0) + 1; });
        expect(perManera).toEqual({ mira: 3, trampa: 3, germana: 3, trossos: 3 });
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'lab' && e.datos.item !== 'estado').length).toBe(16);
        const coh = envios.find(e => e.datos.modulo === 'lab' && e.datos.item === 'es-cohesion').datos;
        expect(coh).toMatchObject({ respuesta: null, correcta: false });
        expect(coh.detalle).toMatchObject({ fase: 'prova', no_lo_se: true });
        await expect.poll(() => envios.some(e => e.datos.modulo === 'lab' && e.datos.item === 'estado')).toBe(true);
    });

    test("l'endemà: una nova de cada manera (mira, trampa, germana, trossos) i, al final, les mateixes de memòria", async ({ page }) => {
        const assig = { 'ca-podem': 'mira', 'es-television': 'trampa', 'ca-important': 'germana', 'es-cohesion': 'trossos', 'ca-entrem': 'mira' };
        const envios = await preparar(page, '2026-11-09', { plan: { enCurso: { id: 10, bloque: 2, fecha: '2026-11-09' } }, lab: ESTAT_REPARTIT(assig) });
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Laboratori de paraules');
        await expect(page.locator('#intro-texto')).not.toContainText('sense correcció');
        await page.click('#btn-intro-vamos');
        const items = await page.evaluate(() => window.__itemsLab());
        expect(items.slice(0, 4)).toEqual([
            { id: 'ca-podem', fase: 'nova' }, { id: 'es-television', fase: 'nova' }, { id: 'ca-important', fase: 'nova' }, { id: 'es-cohesion', fase: 'nova' }
        ]);
        expect(items.slice(4).map(x => x.fase)).toEqual(['final', 'final', 'final', 'final']);
        expect(items.slice(4).map(x => x.id).sort()).toEqual(['ca-important', 'ca-podem', 'es-cohesion', 'es-television']);

        // 1. mira: la paraula amb la lletra de color i el truc
        let p = await actual(page);
        expect(p).toMatchObject({ paraula: 'podem', etapa: 'mira' });
        await expect(page.locator('#lab-gran .clau')).toHaveText('o');
        await expect(page.locator('#lab-truc')).toContainText('sona u');
        await expect(page.locator('#lab-opcions')).toBeHidden();
        expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
        await page.click('#btn-lab-seguir');
        await escriureIFet(page, 'podem');
        let anterior = await ara(page);

        // 2. trampa: els forats; si posa la que no és, es veu la bona i es posa la bona
        p = await seguent(page, anterior);
        expect(p).toMatchObject({ paraula: 'televisión', etapa: 'trampa', forats: ['v', 's'], posades: 0 });
        await expect(page.locator('#lab-gran .forat-lab')).toHaveCount(2);
        await expect(page.locator('#btn-lab-seguir')).toBeHidden();
        await expect(page.locator('#lab-truc')).toContainText('Vi con v');
        await page.click('#lab-opcions [data-lletra="b"]');
        await expect(page.locator('#lab-opcions .lab-opcio.bona')).toHaveText('v');
        await expect.poll(async () => (await actual(page)).posades).toBe(1);
        await page.click('#lab-opcions [data-lletra="s"]');
        await expect(page.locator('#lab-gran .forat-lab')).toHaveCount(0);
        await expect(page.locator('#btn-lab-seguir')).toHaveText('Ja la tinc! Tapa-la 🙈');
        await page.click('#btn-lab-seguir');
        await escriureIFet(page, 'televisión');
        anterior = await ara(page);

        // 3. germana: la paraula de la família a dalt, i posa la lletra; la que no hi va és «—»
        p = await seguent(page, anterior);
        expect(p).toMatchObject({ paraula: 'important', etapa: 'germana', forats: ['t'] });
        await expect(page.locator('#lab-dalt')).toContainText('importantíssim');
        await expect(page.locator('#lab-truc')).toBeHidden();
        expect((await page.locator('#lab-opcions .lab-opcio').allInnerTexts()).sort()).toEqual(['t', '—'].sort());
        await aprendre(page);
        await escriureIFet(page, 'important');
        anterior = await ara(page);

        // 4. trossos: la paraula a trossos, amb el nom de la lletra
        p = await seguent(page, anterior);
        expect(p).toMatchObject({ paraula: 'cohesión', etapa: 'trossos' });
        await expect(page.locator('#lab-truc')).toContainText('sión con ese');
        await aprendre(page);
        await escriureIFet(page, 'cohesión');
        anterior = await ara(page);

        // Les mateixes de memòria. Cohesión, malament: la seva i la bona; toca les lletres que canvien i la torna a escriure
        for (let i = 0; i < 4; i++) {
            p = await seguent(page, anterior);
            expect(p).toMatchObject({ fase: 'final', etapa: 'escriu' });
            if (p.paraula !== 'cohesión') {
                await escriureIFet(page, p.paraula);
                anterior = await ara(page);
                continue;
            }
            await escriureIFet(page, 'coheción');
            await expect(page.locator('#lab-panel')).toBeVisible();
            p = await actual(page);
            expect(p).toMatchObject({ etapa: 'compara', intent: 2, diff: [4] });
            await expect(page.locator('#lab-dalt')).toContainText('coheción');
            await expect(page.locator('#btn-lab-seguir')).toBeHidden();
            expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
            await page.click('#lab-gran [data-i="4"]');
            await expect(page.locator('#lab-gran .lab-lletra.trobada')).toHaveText('s');
            await expect(page.locator('#btn-lab-seguir')).toHaveText('La torno a escriure ✍️');
            await page.click('#btn-lab-seguir');
            // Tampoc: la bona amb les lletres de color i el truc, i seguim (no la torna a escriure)
            await escriureIFet(page, 'cohesion');
            p = await actual(page);
            expect(p).toMatchObject({ etapa: 'compara', intent: 3, diff: [6] });
            await expect(page.locator('#lab-gran .lab-lletra.trobada')).toHaveText('ó');
            await expect(page.locator('#btn-lab-seguir')).toHaveText('Seguim ➜');
            anterior = await ara(page);
            await page.click('#btn-lab-seguir');
        }
        await expect(page.locator('#screen-summary')).toBeVisible();
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');

        const st = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_lab')));
        expect(st.fet).toBe('2026-11-09');
        expect(st.w['es-television']).toMatchObject({ intro: '2026-11-09', metode: 'trampa', racha: 0, dominada: null });
        expect(Object.keys(st.w).sort()).toEqual(['ca-important', 'ca-podem', 'es-cohesion', 'es-television']);
        const dades = envios.filter(e => e.datos.modulo === 'lab' && e.datos.item !== 'estado').map(e => e.datos);
        const tria = dades.filter(d => d.detalle.etapa === 'tria' && d.item === 'es-television');
        expect(tria.map(d => [d.respuesta, d.correcta])).toEqual([['b', false], ['s', true]]);
        const coh = dades.filter(d => d.item === 'es-cohesion' && d.detalle.fase === 'final');
        expect(coh.map(d => [d.respuesta, d.detalle.intent, d.detalle.metode])).toEqual([['coheción', 1, 'trossos'], ['cohesion', 2, 'trossos']]);
        expect(dades.find(d => d.item === 'ca-podem' && d.detalle.fase === 'nova').detalle.mirat_ms).toEqual(expect.any(Number));
    });

    test('les vistes, de memòria primer (3 dies seguits → dominada); cada 4 dies, frases seguides que es repassen amb calma al final', async ({ page }) => {
        const assig = { 'ca-podem': 'mira', 'es-television': 'trampa', 'ca-important': 'germana', 'es-cohesion': 'trossos' };
        const vista = (metode, dies, racha) => ({ intro: '2026-11-09', dies, racha, dominada: null, ultima: '2026-11-11', metode });
        const w = {
            'ca-podem': vista('mira', ['2026-11-10', '2026-11-11'], 2),
            'es-television': vista('trampa', ['2026-11-11'], 1),
            'ca-important': vista('germana', [], 0),
            'es-cohesion': vista('trossos', [], 0)
        };
        const envios = await preparar(page, '2026-11-12', { plan: { enCurso: { id: 10, bloque: 2, fecha: '2026-11-12' } }, lab: ESTAT_REPARTIT(assig, w, { fet: '2026-11-11' }) });
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');

        const fases = (await page.evaluate(() => window.__itemsLab())).map(x => x.fase);
        expect(fases).toEqual([...Array(4).fill('frase'), ...Array(4).fill('recorda'), ...Array(4).fill('revisa')]);

        // Les frases, seguides i sense correcció. La de cohesión, amb «coheción»
        const escrites = {};
        let anterior = 'null';
        for (let i = 0; i < 4; i++) {
            const p = await seguent(page, anterior);
            expect(p.etapa).toBe('frase');
            const frase = p.frase.toLowerCase().replace(/[.?]/g, '');
            const text = p.id === 'es-cohesion' ? frase.replace('cohesión', 'coheción') : frase;
            escrites[p.id] = text;
            await escriureIFet(page, text);
            await expect(page.locator('#gentle-correction-box')).toBeHidden();
            anterior = await ara(page);
        }
        // Les vistes, de memòria: totes bé
        for (let i = 0; i < 4; i++) {
            const p = await seguent(page, anterior);
            expect(p).toMatchObject({ fase: 'recorda', etapa: 'escriu' });
            await escriureIFet(page, p.paraula);
            anterior = await ara(page);
        }
        // El repàs: la seva frase, paraula per paraula; la de cohesión l'arregla
        for (let i = 0; i < 4; i++) {
            const p = await seguent(page, anterior);
            expect(p.etapa).toBe('revisa');
            await expect(page.locator('#lab-gran .lab-mot').first()).toBeVisible();
            expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
            if (p.id === 'es-cohesion') {
                await page.locator('#lab-gran .lab-mot', { hasText: 'coheción' }).click();
                await expect(page.locator('#dictat-escrit')).toHaveText('coheción');
                for (let k = 0; k < 4; k++) await page.click('#teclat-lletres [data-tecla="back"]');
                await escriure(page, 'sión');
                await page.click('#btn-dictat-fet');
                await expect(page.locator('#lab-gran .lab-mot.canviat')).toHaveText('cohesión');
            }
            await page.click('#btn-lab-seguir');
            await expect(page.locator('#lab-gran .clau')).toBeVisible();
            await expect(page.locator('#btn-lab-seguir')).toHaveText('Seguim ➜');
            anterior = await ara(page);
            await page.click('#btn-lab-seguir');
        }
        await expect(page.locator('#screen-summary')).toBeVisible();
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');

        const st = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_lab')));
        expect(st.frases).toBe('2026-11-12');
        expect(st.w['ca-podem']).toMatchObject({ racha: 3, dominada: '2026-11-12', frase: '2026-11-12' });
        expect(st.w['es-television']).toMatchObject({ racha: 2, dominada: null });
        const dades = envios.filter(e => e.datos.modulo === 'lab' && e.datos.item === 'es-cohesion').map(e => e.datos);
        expect(dades.find(d => d.detalle.fase === 'frase')).toMatchObject({ correcta: false, respuesta: escrites['es-cohesion'] });
        const rev = dades.find(d => d.detalle.fase === 'revisa');
        expect(rev).toMatchObject({ correcta: true });
        expect(rev.detalle).toMatchObject({ abans: false, canvis: [expect.objectContaining({ de: 'coheción', a: 'cohesión' })] });
        expect(envios.filter(e => e.datos.modulo === 'lab' && e.datos.detalle && e.datos.detalle.fase === 'frase' && e.datos.correcta)).toHaveLength(3);

        // Fins d'aquí a 4 dies, sense frases
        await page.clock.setFixedTime(new Date('2026-11-13T17:00:00'));
        expect((await page.evaluate(() => window.__itemsLab())).some(x => ['frase', 'revisa'].includes(x.fase))).toBe(false);
    });

    test('les que passen al laboratori ja no surten a Paraules', async ({ page }) => {
        await simularSupabase(page, { lab: true, paraules: true });
        await page.clock.setFixedTime(new Date('2026-11-07T17:00:00'));
        await page.goto(URL_APP);
        const items = await page.evaluate(() => {
            localStorage.setItem('dojo_paraules', JSON.stringify({ w: {
                'ca-important': { intro: '2026-10-30', dies: [], racha: 0, dominada: null, ultima: '2026-11-03' },
                'ca-tambe': { intro: '2026-10-27', dies: [], racha: 0, dominada: null, ultima: '2026-11-03' }
            } }));
            return window.__itemsParaules().map(x => x.id);
        });
        expect(items).toContain('ca-tambe');
        expect(items).not.toContain('ca-important');
        expect(items).not.toContain('ca-necessitem');
    });

    test('abans del 7/11 no hi és, i en pausa tampoc', async ({ page }) => {
        await preparar(page, '2026-11-06');
        await expect(page.locator('#mision-pasos li', { hasText: 'Laboratori' })).toHaveCount(0);
        await page.evaluate(() => localStorage.setItem('dojo_lab', JSON.stringify({ pausa: true })));
        await page.clock.setFixedTime(new Date('2026-11-07T17:00:00'));
        await page.reload();
        await expect(page.locator('#mision-pasos li', { hasText: 'Laboratori' })).toHaveCount(0);
    });
});
