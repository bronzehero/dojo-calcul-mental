// Voz de la Joana: cada texto hablado tiene su MP3 en veu/; si falta, la voz del iPad
const fs = require('fs');
const path = require('path');
const { test, expect, URL_APP, simularSupabase, empezarEnMision } = require('./ayudas');

const VEU = path.resolve(__dirname, '..', 'veu');
function claveVeu(t) {
    let h = 0x811c9dc5;
    for (const ch of t) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193) >>> 0;
    return h.toString(16).padStart(8, '0');
}

test('si el texto tiene MP3, lo pide a veu/ (la Joana) en vez de usar la voz del iPad', async ({ page }) => {
    await simularSupabase(page);
    await page.addInitScript(() => {
        const clau = t => { let h = 0x811c9dc5; for (const ch of t) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193) >>> 0; return h.toString(16).padStart(8, '0'); };
        window.__pedidos = [];
        const original = window.fetch;
        window.fetch = async (url, ...resto) => {
            const u = String(url);
            if (u.endsWith('veu/index.json')) {
                await null;   // el script ya ha definido __textosVeu
                return new Response(JSON.stringify(window.__textosVeu().map(clau)), { status: 200 });
            }
            if (u.includes('veu/')) { window.__pedidos.push(u); return new Response(new ArrayBuffer(8), { status: 200 }); }
            return original(url, ...resto);
        };
    });
    await empezarEnMision(page, 7);
    await page.goto(URL_APP);
    const textos = await page.evaluate(() => window.__textosVeu());
    const intro = textos.find(t => t.startsWith('Restes que passen pel 10'));
    expect(intro).toBeTruthy();
    await page.click('#btn-start-game');
    await expect(page.locator('#intro-titulo')).toHaveText('Passar pel 10');
    await expect.poll(() => page.evaluate(() => window.__pedidos)).toContain(`veu/${claveVeu(intro)}.mp3`);
});

test('todo lo que dice en voz alta tiene su MP3 (si no, ejecutar veu/genera.sh)', async ({ page }) => {
    const indice = path.join(VEU, 'index.json');
    test.skip(!fs.existsSync(indice), 'todavía no se han generado los MP3');
    await simularSupabase(page);
    await page.goto(URL_APP);
    const textos = await page.evaluate(() => window.__textosVeu());
    expect(textos.length).toBeGreaterThan(10);
    const lista = JSON.parse(fs.readFileSync(indice, 'utf8'));
    for (const t of textos) {
        const k = claveVeu(t);
        expect(lista, t).toContain(k);
        expect(fs.existsSync(path.join(VEU, `${k}.mp3`)), t).toBe(true);
    }
});

test('ningún texto hablado acaba una palabra en «set.» (la voz lo lee como la abreviatura de setembre)', async ({ page }) => {
    await simularSupabase(page);
    await page.goto(URL_APP);
    const textos = await page.evaluate(() => window.__textosVeu());
    for (const t of textos) expect(t, t).not.toMatch(/\bset\.(\s|$)/i);
});
