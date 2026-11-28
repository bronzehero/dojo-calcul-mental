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
    await page.clock.setFixedTime(new Date('2026-11-12T17:00:00')); // la misión con «Passar pel 10» (hasta el 12/11)
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

test('iPad: si el sonido queda «interrupted» (pantalla bloqueada, notificación), cada toque lo vuelve a encender', async ({ page }) => {
    await simularSupabase(page);
    await page.addInitScript(() => {
        window.__resums = 0;
        window.__ctxs = [];
        class AudioFals {
            constructor() { this.state = 'interrupted'; this.currentTime = 0; this.destination = {}; window.__ctxs.push(this); }
            resume() { window.__resums++; this.state = 'running'; return Promise.resolve(); }
            createOscillator() { return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
            createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
        }
        window.AudioContext = AudioFals;
    });
    await page.goto(URL_APP);
    await page.mouse.click(5, 5);
    await expect.poll(() => page.evaluate(() => window.__estatAudio())).toBe('running');
    const abans = await page.evaluate(() => window.__resums);
    expect(abans).toBeGreaterThan(0);
    // Torna a quedar interromput a mitja sessió: el següent toc el torna a engegar (abans, només el primer toc i només «suspended»)
    await page.evaluate(() => { window.__ctxs.forEach(c => { c.state = 'interrupted'; }); });
    await page.mouse.click(5, 5);
    await expect.poll(() => page.evaluate(() => window.__estatAudio())).toBe('running');
    expect(await page.evaluate(() => window.__resums)).toBeGreaterThan(abans);
    expect(await page.evaluate(() => window.__ctxs.length)).toBe(1);
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
