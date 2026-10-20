// Paraules (ortografia paraula a paraula): des del 18/10, cada dia al final de l'entrenament o del repàs del diumenge,
// DINS de la missió. La missió no és complerta fins que s'acaben les paraules.
const { test, expect, URL_APP, simularSupabase, contestarBloqueNumerico } = require('./ayudas');

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+|malament|incorrect/i;
const PLAN_ACABAT = [1, 2, 3, 4, 5, 6].map(id => ({ id, fecha: '2026-01-01' })).concat([{ id: 10, fecha: '2026-10-17' }]);
const EXTRES_FETES = [{ id: 102, fecha: '2026-10-16' }, { id: 103, fecha: '2026-10-17' }];
const PRIMERES = ['bien', 'hemos', 'ha dicho', 'estaba'];

async function preparar(page, dia, { plan = {}, paraules = null } = {}) {
    const { envios } = await simularSupabase(page, { paraules: true });
    await page.clock.setFixedTime(new Date(`${dia}T17:00:00`));
    await page.addInitScript(([p, st]) => {
        if (sessionStorage.getItem('plan-preparado')) return;
        sessionStorage.setItem('plan-preparado', '1');
        localStorage.setItem('dojo_plan', JSON.stringify(p));
        if (st) localStorage.setItem('dojo_paraules', JSON.stringify(st));
    }, [{ hechas: PLAN_ACABAT, extras: EXTRES_FETES, ...plan }, paraules]);
    await page.goto(URL_APP);
    return envios;
}

/** Escriu amb el teclat de lletres de la pantalla (també espais i apòstrofs) */
async function escriure(page, text) {
    for (const c of text) await page.click(`#teclat-lletres [data-tecla="${c}"]`);
}

const actual = page => page.evaluate(() => window.__paraulaActual());
/** Espera que surti la paraula següent (després de la celebració) */
async function seguent(page, anterior) {
    await expect.poll(async () => JSON.stringify(await actual(page))).not.toBe(anterior);
    return actual(page);
}
const ara = async page => JSON.stringify(await actual(page));

/** Contesta la paraula que hi ha a la pantalla; si és nova, primer la mira i la tapa. */
async function contestarParaula(page, text = null) {
    const p = await actual(page);
    if (p.etapa === 'mira') {
        await expect(page.locator('#paraules-panel')).toBeVisible();
        await expect(page.locator('#paraula-gran')).toHaveText(p.paraula);
        await page.click('#btn-paraula-seguir');
    }
    await expect(page.locator('#dictat-panel')).toBeVisible();
    await expect(page.locator('#paraules-panel')).toBeHidden();
    await escriure(page, text ?? p.paraula);
    await page.click('#btn-dictat-fet');
    return p;
}

test.describe('Paraules', () => {
    test('el diumenge 18/10 van dins del repàs: noves (mirar → tapar → escriure) i, al final, les mateixes de memòria', async ({ page }) => {
        const envios = await preparar(page, '2026-10-18');
        await expect(page.locator('#mision-titulo')).toHaveText('Missió de repàs');
        await expect(page.locator('#mision-pasos li').last()).toHaveText('🔤 Paraules');
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        await contestarBloqueNumerico(page);

        await expect(page.locator('#intro-titulo')).toHaveText('Paraules');
        await page.click('#btn-intro-vamos');

        // 1a: «bien», nova. La mira amb la lletra que costa de color i el truc
        let p = await actual(page);
        expect(p).toMatchObject({ paraula: 'bien', fase: 'nova', etapa: 'mira' });
        await expect(page.locator('#paraula-gran .clau')).toHaveText('b');
        await expect(page.locator('#paraula-truc')).toContainText('B de Bueno');
        await expect(page.locator('#op-factors')).toContainText('castellà');
        expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
        // La tapa i l'escriu malament: la torna a veure, amb el que ha escrit, i la torna a escriure
        await contestarParaula(page, 'vien');
        await expect(page.locator('#paraules-panel')).toBeVisible();
        await expect(page.locator('#paraula-tu')).toContainText('vien');
        await expect(page.locator('#btn-paraula-seguir')).toHaveText('La torno a escriure ✍️');
        expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
        await page.click('#btn-paraula-seguir');
        await expect(page.locator('#paraules-panel')).toBeHidden();
        await escriure(page, 'bien');
        await page.click('#btn-dictat-fet');

        // La resta: 3 noves més i, al final, les 4 de memòria (sense veure-les abans)
        const vistes = ['bien'];
        let anterior = await ara(page);
        for (let i = 1; i < 8; i++) {
            await seguent(page, anterior);
            p = await contestarParaula(page);
            anterior = await ara(page);
            vistes.push(p.paraula);
            expect(p.fase).toBe(i < 4 ? 'nova' : 'final');
            if (i >= 4) expect(p.etapa).toBe('escriu');
        }
        expect(vistes.slice(0, 4)).toEqual(PRIMERES);
        expect([...vistes.slice(4)].sort()).toEqual([...PRIMERES].sort());

        // Ara sí: missió complerta, amb photocard
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');
        await expect(page.locator('#photocard-zona')).toBeVisible();

        await expect.poll(() => envios.filter(e => e.datos.modulo === 'paraules' && e.datos.item !== 'estado').length).toBe(9);
        const dades = envios.filter(e => e.datos.modulo === 'paraules' && e.datos.item !== 'estado').map(e => e.datos);
        expect(dades[0]).toMatchObject({ item: 'es-bien', esperado: 'bien', respuesta: 'vien', correcta: false });
        expect(dades[0].detalle).toMatchObject({ fase: 'nova', intent: 1, idioma: 'es', mision: 11 });
        expect(dades[0].detalle.mirat_ms).toEqual(expect.any(Number));
        expect(dades[1]).toMatchObject({ item: 'es-bien', respuesta: 'bien', correcta: true });
        expect(dades[1].detalle.intent).toBe(2);
        expect(dades.slice(1).every(d => d.correcta)).toBe(true);
        expect(dades.find(d => d.esperado === 'ha dicho').respuesta).toBe('ha dicho');

        const st = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_paraules')));
        expect(st.fet).toBe('2026-10-18');
        expect(Object.keys(st.w).sort()).toEqual(['es-bien', 'es-estaba', 'es-ha-dicho', 'es-hemos']);
        expect(Object.values(st.w).every(e => e.intro === '2026-10-18' && e.racha === 0 && !e.dominada)).toBe(true);
        await expect.poll(() => envios.some(e => e.datos.modulo === 'paraules' && e.datos.item === 'estado')).toBe(true);

        const plan = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_plan')));
        expect(plan.extras.filter(x => x.id === 11)).toEqual([{ id: 11, fecha: '2026-10-18' }]);
        await page.click('#btn-summary-home');
        await expect(page.locator('#mision-hecha')).toBeVisible();
    });

    test('si para a mig de les paraules, la missió no és complerta: la propera vegada segueix per les paraules', async ({ page }) => {
        await preparar(page, '2026-10-18');
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        await contestarBloqueNumerico(page);
        await page.click('#btn-intro-vamos');
        await contestarParaula(page);
        await page.click('#btn-exit-game');
        await expect(page.locator('#summary-titulo')).not.toHaveText(/Missió complerta/);
        await expect(page.locator('#photocard-zona')).toBeHidden();
        const plan = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_plan')));
        expect((plan.extras || []).some(x => x.id === 11)).toBe(false);

        await page.click('#btn-summary-home');
        await expect(page.locator('#mision-hecha')).toBeHidden();
        await expect(page.locator('#mision-pasos li').first()).toHaveText(/^✅/);
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Paraules');
    });

    test("l'endemà: primer les d'ahir de memòria i després 4 noves; 3 dies seguits bé al primer intent → dominada", async ({ page }) => {
        const ahir = { intro: '2026-10-18', dies: [], racha: 0, dominada: null, ultima: '2026-10-18' };
        const paraules = {
            fet: '2026-10-18',
            w: {
                'es-bien': { ...ahir, intro: '2026-10-16', dies: ['2026-10-17', '2026-10-18'], racha: 2 },
                'es-hemos': ahir, 'es-ha-dicho': ahir, 'es-estaba': ahir
            }
        };
        // Directe a les paraules (els blocs de l'entrenament ja fets avui)
        const envios = await preparar(page, '2026-10-19', { plan: { enCurso: { id: 10, bloque: 2, fecha: '2026-10-19' } }, paraules });
        await expect(page.locator('#mision-titulo')).toHaveText('Entrenament');
        await expect(page.locator('#mision-pasos li').last()).toHaveText('🔤 Paraules');
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Paraules');
        await page.click('#btn-intro-vamos');

        const fases = [];
        let anterior = 'null';
        for (let i = 0; i < 12; i++) {
            const p = await seguent(page, anterior);
            fases.push([p.fase, p.etapa, p.paraula]);
            // «estaba» d'ahir, de memòria, malament: torna a practicar-la
            if (p.paraula === 'estaba' && p.fase === 'recorda') {
                await contestarParaula(page, 'estava');
                await page.click('#btn-paraula-seguir');
                await escriure(page, 'estaba');
                await page.click('#btn-dictat-fet');
            } else await contestarParaula(page);
            anterior = await ara(page);
        }
        // Les d'ahir surten primer i sense veure-les; les noves són les 4 següents de la llista
        expect(fases.slice(0, 4).every(([f, e]) => f === 'recorda' && e === 'escriu')).toBe(true);
        expect(fases.slice(4, 8).map(x => x[2])).toEqual(['hicimos', 'información', 'busqué', 'fotografías']);
        expect(fases.slice(4, 8).every(([f, e]) => f === 'nova' && e === 'mira')).toBe(true);
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');

        const st = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_paraules')));
        expect(st.w['es-bien']).toMatchObject({ racha: 3, dominada: '2026-10-19' });
        expect(st.w['es-hemos']).toMatchObject({ racha: 1, dominada: null, dies: ['2026-10-19'] });
        expect(st.w['es-estaba']).toMatchObject({ racha: 0, dominada: null });
        expect(st.w['es-hicimos'].intro).toBe('2026-10-19');
        const recorda = envios.filter(e => e.datos.modulo === 'paraules' && e.datos.detalle.fase === 'recorda' && e.datos.detalle.intent === 1);
        expect(recorda).toHaveLength(4);
    });

    test('la h d\'un verb (hemos, hicimos): si no surt de memòria, primer l\'escriu dins de la seva família; si tampoc, la mira com sempre', async ({ page }) => {
        const ahir = { intro: '2026-10-19', dies: [], racha: 0, dominada: null, ultima: '2026-10-20' };
        const paraules = { fet: '2026-10-20', w: { 'es-hemos': ahir, 'es-hicimos': ahir } };
        const envios = await preparar(page, '2026-10-21', { plan: { enCurso: { id: 10, bloque: 2, fecha: '2026-10-21' } }, paraules });
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Paraules');
        await page.click('#btn-intro-vamos');

        // hemos: a la família surt bé · hicimos: tampoc a la família → la torna a mirar (amb el truc) i la torna a escriure
        let anterior = 'null', vistes = 0;
        for (let i = 0; i < 12 && vistes < 2; i++) {
            const p = await seguent(page, anterior);
            if (p.fase !== 'recorda') { await contestarParaula(page); anterior = await ara(page); continue; }
            vistes++;
            expect(p.etapa).toBe('escriu');
            await expect(page.locator('#paraula-familia')).toBeHidden();
            await contestarParaula(page, p.paraula.slice(1));
            await expect.poll(async () => (await actual(page)).etapa).toBe('familia');
            const fam = page.locator('#paraula-familia');
            await expect(fam).toBeVisible();
            await expect(page.locator('#paraules-panel')).toBeHidden();
            await expect(page.locator('#dictat-panel')).not.toContainText(PROHIBIDO_EN_PANTALLA);
            await expect(fam.locator('.buit-familia')).toHaveCount(1);
            if (p.paraula === 'hemos') {
                // El verb, les altres amb la h de color i un forat per a la que falta
                await expect(fam.locator('.verb')).toHaveText('HABER');
                await expect(fam.locator('.membre')).toHaveText(['he', 'has', 'ha', 'habéis', 'han']);
                await expect(fam.locator('.clau')).toHaveCount(5);
                await escriure(page, 'hemos');
                await page.click('#btn-dictat-fet');
            } else {
                await expect(fam.locator('.verb')).toHaveText('HACER');
                await escriure(page, 'isimos');
                await page.click('#btn-dictat-fet');
                await expect.poll(async () => (await actual(page)).etapa).toBe('corregeix');
                await expect(page.locator('#paraules-panel')).toBeVisible();
                await expect(fam).toBeHidden();
                await page.click('#btn-paraula-seguir');
                await escriure(page, 'hicimos');
                await page.click('#btn-dictat-fet');
            }
            anterior = await ara(page);
        }
        expect(vistes).toBe(2);
        for (let i = 0; i < 8 && !(await page.locator('#summary-titulo').isVisible()); i++) {
            await seguent(page, anterior);
            await contestarParaula(page);
            anterior = await ara(page);
        }
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');

        const dades = envios.filter(e => e.datos.modulo === 'paraules' && e.datos.item !== 'estado').map(e => e.datos);
        const de = id => dades.filter(d => d.item === id).map(d => [d.respuesta, d.correcta, d.detalle.intent, !!d.detalle.familia]);
        expect(de('es-hemos')).toEqual([['emos', false, 1, false], ['hemos', true, 2, true]]);
        expect(de('es-hicimos')).toEqual([['icimos', false, 1, false], ['isimos', false, 2, true], ['hicimos', true, 3, false]]);
        // El primer intent és la mesura: la família no la compta com a bona
        const st = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_paraules')));
        expect(st.w['es-hemos']).toMatchObject({ racha: 0, dies: [] });
    });

    test('«No ho sé»: la torna a veure i la torna a escriure, com si s\'hagués equivocat', async ({ page }) => {
        const envios = await preparar(page, '2026-10-18');
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        await contestarBloqueNumerico(page);
        await page.click('#btn-intro-vamos');
        await page.click('#btn-paraula-seguir');
        await expect(page.locator('#btn-no-ho-se')).toBeVisible();
        await page.click('#btn-no-ho-se');
        await expect(page.locator('#paraules-panel')).toBeVisible();
        await expect(page.locator('#paraula-tu')).toHaveText('Mira-la bé:');
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'paraules').length).toBe(1);
        const d = envios.find(e => e.datos.modulo === 'paraules').datos;
        expect(d).toMatchObject({ respuesta: null, correcta: false });
        expect(d.detalle.no_lo_se).toBe(true);
    });

    test('en pausa (o abans del 18/10) no surten', async ({ page }) => {
        await preparar(page, '2026-10-19', { paraules: { pausa: true, w: {} } });
        await expect(page.locator('#mision-pasos li')).not.toContainText(['🔤 Paraules']);
        const altra = await page.context().newPage();
        await simularSupabase(altra, { paraules: true });
        await altra.clock.setFixedTime(new Date('2026-10-17T17:00:00'));
        await altra.addInitScript(p => localStorage.setItem('dojo_plan', JSON.stringify(p)), { hechas: PLAN_ACABAT, extras: EXTRES_FETES });
        await altra.goto(URL_APP);
        await expect(altra.locator('#mision-titulo')).toHaveText('Entrenament');
        await expect(altra.locator('#mision-pasos li')).toHaveCount(2);
    });
});
