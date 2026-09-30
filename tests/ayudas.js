// Utilidades comunes de las pruebas del Dojo
const path = require('path');
const { test: base, expect } = require('@playwright/test');

const URL_APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

/**
 * Intercepta TODO lo que va a Supabase: las pruebas nunca tocan los datos reales.
 * opciones.eventos / opciones.registros: 'ok' | 'no-existe' (404) | 'sin-detalle' (400 si llega la columna detalle)
 * opciones.datos: lo que devuelve leer_datos con la clave buena (CLAVE_BUENA)
 */
const CLAVE_BUENA = 'clau-de-prova-123';

async function simularSupabase(page, opciones = {}) {
    const estado = { eventos: 'ok', registros: 'ok', datos: { registros: [], eventos: [] }, ...opciones };
    const envios = [];
    const lecturas = [];
    await page.route('**/*.supabase.co/**', async (ruta) => {
        const req = ruta.request();
        const tabla = new URL(req.url()).pathname.split('/rest/v1/')[1] || '';
        if (tabla === 'rpc/leer_datos') {
            const { clave } = JSON.parse(req.postData() || '{}');
            lecturas.push({ rpc: true, clave });
            if (clave !== CLAVE_BUENA) {
                return ruta.fulfill({ status: 403, contentType: 'application/json', body: '{"code":"28P01","message":"clau incorrecta"}' });
            }
            return ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(estado.datos) });
        }
        if (req.method() === 'GET') lecturas.push({ url: req.url() });
        if (req.method() === 'POST') {
            const datos = JSON.parse(req.postData() || '{}');
            const modo = estado[tabla.startsWith('eventos') ? 'eventos' : 'registros'];
            if (modo === 'no-existe') return ruta.fulfill({ status: 404, body: '{}' });
            if (modo === 'sin-detalle' && 'detalle' in datos) return ruta.fulfill({ status: 400, body: '{"code":"PGRST204"}' });
            envios.push({ tabla: tabla.split('?')[0], datos });
            return ruta.fulfill({ status: 201, body: '' });
        }
        return ruta.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    return { envios, estado, lecturas };
}

/** Deja el plan del iPad en la misión indicada (1 = primera) antes de cargar la página. */
async function empezarEnMision(page, numero, extra = {}) {
    await page.addInitScript(([n, ex]) => {
        if (sessionStorage.getItem('plan-preparado')) return;
        sessionStorage.setItem('plan-preparado', '1');
        const hechas = [];
        for (let i = 1; i < n; i++) hechas.push({ id: i, fecha: '2026-01-01' });
        localStorage.setItem('dojo_plan', JSON.stringify({ hechas, ...ex }));
    }, [numero, extra]);
}

/** Calcula la respuesta correcta de lo que hay en pantalla. */
function respuestaCorrecta(texto) {
    if (texto.includes('×')) { const [a, b] = texto.split('×').map(x => parseInt(x, 10)); return a * b; }
    if (texto.includes('+')) { const [a, b] = texto.split('+').map(x => parseInt(x, 10)); return a + b; }
    if (texto.includes('−')) { const [a, b] = texto.split('−').map(x => parseInt(x, 10)); return a - b; }
    return parseInt(texto, 10);
}

async function teclear(page, numero) {
    for (const c of String(numero)) await page.click(`#keypad [data-key="${c}"]`);
    await page.click('#btn-submit-answer');
}

/** Contesta todo el bloque numérico que haya en pantalla. fallarEn: índices a fallar a propósito. */
async function contestarBloqueNumerico(page, fallarEn = []) {
    let n = 0;
    while (await page.isVisible('#screen-game')) {
        const texto = await page.textContent('#op-factors');
        const ok = respuestaCorrecta(texto);
        if (fallarEn.includes(n)) {
            await teclear(page, ok === 99 ? 98 : ok + 1);
            await expect(page.locator('#gentle-correction-box')).toBeVisible();
            await page.click('#btn-correction-continue');
        } else {
            await teclear(page, ok);
            await page.waitForTimeout(850);
        }
        n++;
    }
    return n;
}

async function leerCola(page) {
    return page.evaluate(() => JSON.parse(localStorage.getItem('dojo_pendientes') || '[]'));
}

/** Prueba base: falla si la página lanza cualquier error de JavaScript. */
const test = base.extend({
    page: async ({ page }, use) => {
        const errores = [];
        page.on('pageerror', e => errores.push(e.message));
        await use(page);
        expect(errores, 'errores de JavaScript en la página').toEqual([]);
    }
});

module.exports = {
    test, expect, URL_APP, CLAVE_BUENA, simularSupabase, empezarEnMision, respuestaCorrecta,
    teclear, contestarBloqueNumerico, leerCola
};
