// Photocards: recompensa por acabar la misión (nunca por acertar). Hay 36 idols en pixel art
// dibujadas por la app y, además, las fotos que pone papá en la Zona Papá, que se quedan
// solo en el iPad: nunca se envían a ningún sitio.
const {
    test, expect, URL_APP, simularSupabase, empezarEnMision, contestarBloqueNumerico, irAlUltimoBloque
} = require('./ayudas');

// Imagen PNG de 1×1 válida
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const TODAS_LAS_IDOLS = [];
for (let i = 0; i < 6; i++) for (let c = 0; c < 6; c++) TODAS_LAS_IDOLS.push({ id: `idol-${i}-${c}`, fecha: '2026-01-01' });

/** Vigila todas las peticiones de la página: ninguna puede llevar una foto. */
function vigilarPeticiones(page) {
    const peticiones = [];
    page.on('request', r => peticiones.push({ url: r.url(), cuerpo: r.postData() || '' }));
    return peticiones;
}

async function subirFotos(page, archivos) {
    await page.click('#btn-open-papa');
    await page.setInputFiles('#inp-fotos', archivos);
    await expect(page.locator('#fotos-lista .foto-mini')).toHaveCount(archivos.filter(a => a.buffer === PNG).length);
}

async function acabarMision(page, fallarEn = []) {
    await page.click('#btn-start-game');
    await page.click('#btn-intro-vamos');
    await contestarBloqueNumerico(page, fallarEn);
    await expect(page.locator('#summary-titulo')).toHaveText(/^Missió complerta/);
}

/** Le da al iPad una colección ya hecha (antes de cargar la página). */
async function conAlbum(page, album) {
    await page.addInitScript(a => {
        if (sessionStorage.getItem('album-preparado')) return;
        sessionStorage.setItem('album-preparado', '1');
        localStorage.setItem('dojo_album', JSON.stringify(a));
    }, album);
}

test.describe('Photocards', () => {
    test('sin fotos de papá sale una idol en pixel art, aunque falle todo, y entra en la colección', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 1, { enCurso: { id: 1, bloque: 1 } });
        await page.goto(URL_APP);
        await expect(page.locator('#btn-album')).toBeHidden();
        await acabarMision(page, 'todas');
        await expect(page.locator('#photocard-zona')).toBeVisible();
        await expect(page.locator('#photocard-dins img.pixel')).toBeVisible();
        expect(await page.getAttribute('#photocard-dins img', 'src')).toMatch(/^data:image\/png/);
        await expect(page.locator('#photocard-etiqueta')).toHaveText('Photocard nova! ✦');
        await expect(page.locator('#summary-gema')).toBeHidden();
        const album = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_album')));
        expect(album).toHaveLength(1);
        expect(album[0].id).toMatch(/^idol-[0-5]-[0-5]$/);
        await page.click('#btn-summary-home');
        await expect(page.locator('#btn-album')).toHaveText('🃏 La meva col·lecció (1)');
        await page.click('#btn-album');
        await expect(page.locator('#album-grid img')).toHaveCount(1);
        await expect(page.locator('#album-texto')).toHaveText('Tens 1 photocard. Cada missió acabada, una de nova!');
    });

    test('las 36 idols se dibujan bien y son todas distintas', async ({ page }) => {
        await simularSupabase(page);
        await conAlbum(page, TODAS_LAS_IDOLS);
        await page.goto(URL_APP);
        await page.click('#btn-album');
        await expect(page.locator('#album-grid img')).toHaveCount(36);
        const srcs = await page.$$eval('#album-grid img', imgs => imgs.map(i => i.src));
        expect(new Set(srcs).size).toBe(36);
        // Cada imagen carga de verdad (ancho natural de 30 píxeles × 8)
        const anchos = await page.$$eval('#album-grid img', imgs => Promise.all(imgs.map(i => i.decode().then(() => i.naturalWidth))));
        expect(anchos.every(a => a === 240)).toBe(true);
    });

    test('con fotos de papá: entran en el sorteo; cuando ya lo tiene todo, repite sin decir "nova"; nada sale del iPad', async ({ page }) => {
        const peticiones = vigilarPeticiones(page);
        await simularSupabase(page);
        await conAlbum(page, TODAS_LAS_IDOLS);
        await empezarEnMision(page, 1, { enCurso: { id: 1, bloque: 1 } });
        await page.goto(URL_APP);

        await subirFotos(page, [
            { name: 'a.png', mimeType: 'image/png', buffer: PNG },
            { name: 'rota.png', mimeType: 'image/png', buffer: Buffer.from('esto no es una imagen') }
        ]);
        await expect(page.locator('#fotos-msg')).toContainText('1 foto ·');
        await expect(page.locator('#fotos-msg')).toContainText('1 no se han podido leer');
        await page.click('#btn-close-papa');

        // Ya tiene las 36 idols: la única nueva es la foto de papá
        await acabarMision(page);
        await expect(page.locator('#photocard-etiqueta')).toHaveText('Photocard nova! ✦');
        expect(await page.getAttribute('#photocard-dins img', 'src')).toMatch(/^data:image\/jpeg/);
        await page.click('#btn-summary-home');
        await expect(page.locator('#btn-album')).toHaveText('🃏 La meva col·lecció (37)');

        // Ya lo tiene todo: sale una de las suyas, sin decir "nova"
        await irAlUltimoBloque(page, 2);
        await acabarMision(page);
        await expect(page.locator('#photocard-dins img')).toBeVisible();
        await expect(page.locator('#photocard-etiqueta')).toHaveText('Photocard d\'avui ✦');
        await page.click('#btn-summary-home');
        await expect(page.locator('#btn-album')).toHaveText('🃏 La meva col·lecció (37)');

        // Ninguna petición lleva una imagen, y solo se habla con Supabase y las fuentes
        expect(peticiones.filter(p => p.cuerpo.includes('data:image'))).toEqual([]);
        const hosts = new Set(peticiones.filter(p => p.url.startsWith('http')).map(p => new URL(p.url).hostname));
        for (const h of hosts) expect(h).toMatch(/supabase\.co$|fonts\.(googleapis|gstatic)\.com$/);
    });

    test('papá puede borrar fotos y la colección se ajusta', async ({ page }) => {
        await simularSupabase(page);
        await conAlbum(page, TODAS_LAS_IDOLS);
        await empezarEnMision(page, 1, { enCurso: { id: 1, bloque: 1 } });
        await page.goto(URL_APP);
        await subirFotos(page, [{ name: 'a.png', mimeType: 'image/png', buffer: PNG }]);
        await page.click('#btn-close-papa');
        await acabarMision(page);
        await page.click('#btn-summary-home');
        await expect(page.locator('#btn-album')).toHaveText('🃏 La meva col·lecció (37)');

        await page.click('#btn-open-papa');
        await expect(page.locator('#fotos-msg')).toContainText('le quedan 0 por descubrir');
        await page.click('#fotos-lista .foto-mini button');
        await expect(page.locator('#fotos-lista .foto-mini')).toHaveCount(0);
        await expect(page.locator('#fotos-msg')).toHaveText('Todavía no hay fotos.');
        await page.click('#btn-close-papa');
        await expect(page.locator('#btn-album')).toHaveText('🃏 La meva col·lecció (36)');
    });

    test('si para a medias no hay photocard (sale al acabar la misión)', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 1, { enCurso: { id: 1, bloque: 1 } });
        await page.goto(URL_APP);
        await page.click('#btn-start-game');
        await page.click('#btn-intro-parar');
        await expect(page.locator('#summary-titulo')).toHaveText('Molt bona feina!');
        await expect(page.locator('#photocard-zona')).toBeHidden();
        await expect(page.locator('#summary-gema')).toBeVisible();
    });

    for (const [nombre, tam] of [['horizontal', { width: 1180, height: 820 }], ['vertical', { width: 820, height: 1180 }]]) {
        test(`la photocard y el botón de volver caben en la pantalla (${nombre})`, async ({ page }) => {
            await page.setViewportSize(tam);
            await simularSupabase(page);
            await empezarEnMision(page, 1, { enCurso: { id: 1, bloque: 1 } });
            await page.goto(URL_APP);
            await acabarMision(page);
            await expect(page.locator('#photocard')).toBeInViewport();
            await expect(page.locator('#btn-summary-home')).toBeInViewport();
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        });
    }
});
