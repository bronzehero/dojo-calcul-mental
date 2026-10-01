// Photocards: recompensa por acabar la misión (nunca por acertar). Las fotos las pone papá
// en la Zona Papá y se quedan solo en el iPad: nunca se envían a ningún sitio.
const {
    test, expect, URL_APP, simularSupabase, empezarEnMision, contestarBloqueNumerico, irAlUltimoBloque
} = require('./ayudas');

// Imagen PNG de 1×1 válida
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

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

test.describe('Photocards', () => {
    test('sin fotos, al acabar sale la carta de la gema y no hay colección', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 1, { enCurso: { id: 1, bloque: 1 } });
        await page.goto(URL_APP);
        await expect(page.locator('#btn-album')).toBeHidden();
        await acabarMision(page);
        await expect(page.locator('#photocard-zona')).toBeVisible();
        await expect(page.locator('#photocard-dins svg')).toBeVisible();
        await expect(page.locator('#summary-gema')).toBeHidden();
        await expect(page.locator('#photocard-etiqueta')).toHaveText('Photocard d\'avui ✦');
        await page.click('#btn-summary-home');
        await expect(page.locator('#btn-album')).toBeHidden();
    });

    test('con fotos: una nueva por misión acabada, aunque falle todo; luego repite; nada sale del iPad', async ({ page }) => {
        const peticiones = vigilarPeticiones(page);
        await simularSupabase(page);
        await empezarEnMision(page, 1, { enCurso: { id: 1, bloque: 1 } });
        await page.goto(URL_APP);

        await subirFotos(page, [
            { name: 'a.png', mimeType: 'image/png', buffer: PNG },
            { name: 'b.png', mimeType: 'image/png', buffer: PNG },
            { name: 'rota.png', mimeType: 'image/png', buffer: Buffer.from('esto no es una imagen') }
        ]);
        await expect(page.locator('#fotos-msg')).toContainText('2 fotos');
        await expect(page.locator('#fotos-msg')).toContainText('1 no se han podido leer');
        await page.click('#btn-close-papa');

        // Misión 1: falla todas las respuestas y aun así gana su photocard
        await acabarMision(page, 'todas');
        await expect(page.locator('#photocard-dins img')).toBeVisible();
        expect(await page.getAttribute('#photocard-dins img', 'src')).toMatch(/^data:image\/jpeg/);
        await expect(page.locator('#photocard-etiqueta')).toHaveText('Photocard nova! ✦');
        await expect(page.locator('#summary-gema')).toBeHidden();
        await page.click('#btn-summary-home');
        await expect(page.locator('#btn-album')).toHaveText('🃏 La meva col·lecció (1)');

        // Misión 2: la segunda foto
        await irAlUltimoBloque(page, 2);
        await acabarMision(page);
        await expect(page.locator('#photocard-etiqueta')).toHaveText('Photocard nova! ✦');
        await page.click('#btn-summary-home');
        await expect(page.locator('#btn-album')).toHaveText('🃏 La meva col·lecció (2)');

        // Misión 4: ya las tiene todas; sale una de las suyas, sin decir "nova"
        await irAlUltimoBloque(page, 4);
        await acabarMision(page);
        await expect(page.locator('#photocard-dins img')).toBeVisible();
        await expect(page.locator('#photocard-etiqueta')).toHaveText('Photocard d\'avui ✦');
        await page.click('#btn-summary-home');
        await expect(page.locator('#btn-album')).toHaveText('🃏 La meva col·lecció (2)');

        // La colección
        await page.click('#btn-album');
        await expect(page.locator('#album-grid img')).toHaveCount(2);
        await expect(page.locator('#album-texto')).toHaveText('Tens 2 photocards. Cada missió acabada, una de nova!');
        await page.click('#btn-album-tornar');
        await expect(page.locator('#saludo')).toBeVisible();

        // Ninguna petición lleva una imagen, y solo se habla con Supabase y las fuentes
        expect(peticiones.filter(p => p.cuerpo.includes('data:image'))).toEqual([]);
        const hosts = new Set(peticiones.filter(p => p.url.startsWith('http')).map(p => new URL(p.url).hostname));
        for (const h of hosts) expect(h).toMatch(/supabase\.co$|fonts\.(googleapis|gstatic)\.com$/);
    });

    test('papá puede borrar fotos y la colección se ajusta', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 1, { enCurso: { id: 1, bloque: 1 } });
        await page.goto(URL_APP);
        await subirFotos(page, [{ name: 'a.png', mimeType: 'image/png', buffer: PNG }]);
        await page.click('#btn-close-papa');
        await acabarMision(page);
        await page.click('#btn-summary-home');
        await expect(page.locator('#btn-album')).toHaveText('🃏 La meva col·lecció (1)');

        await page.click('#btn-open-papa');
        await expect(page.locator('#fotos-msg')).toContainText('le quedan 0 por descubrir');
        await page.click('#fotos-lista .foto-mini button');
        await expect(page.locator('#fotos-lista .foto-mini')).toHaveCount(0);
        await expect(page.locator('#fotos-msg')).toHaveText('Todavía no hay fotos.');
        await page.click('#btn-close-papa');
        await expect(page.locator('#btn-album')).toBeHidden();
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
            await subirFotos(page, [{ name: 'a.png', mimeType: 'image/png', buffer: PNG }]);
            await page.click('#btn-close-papa');
            await acabarMision(page);
            await expect(page.locator('#photocard')).toBeInViewport();
            await expect(page.locator('#btn-summary-home')).toBeInViewport();
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        });
    }
});
