let usuariActual = null;
let usuarisCarregats = [];

async function carregarUsuaris() {
    ui.elements.usuarisExistents.innerHTML = '<p>Carregant usuaris...</p>';
    try {
        const response = await fetch(`${URL_APP_SCRIPT}?action=getUsers`);
        const usuaris = await response.json();
        if (Array.isArray(usuaris)) {
            usuarisCarregats = usuaris;
            localStorage.setItem('dojoUsuaris', JSON.stringify(usuaris));
            mostrarBotonsUsuari(usuaris);
        } else {
            throw new Error("Format de resposta incorrecte.");
        }
    } catch (error) {
        console.error("Error en carregar usuaris del Sheet, usant còpia local:", error);
        usuarisCarregats = JSON.parse(localStorage.getItem('dojoUsuaris')) || [];
        mostrarBotonsUsuari(usuarisCarregats);
    }
}

async function iniciarSessioUsuari(nom) {
    usuariActual = nom;
    ui.elements.menuBenvinguda.textContent = `Carregant dades de ${usuariActual}...`;
    mostrarPantalla('menuPrincipal');
    try {
        const response = await fetch(`${URL_APP_SCRIPT}?action=getUserData&user=${encodeURIComponent(nom)}`);
        const historial = await response.json();
        processarDadesServidor(historial);
        ui.elements.menuBenvinguda.textContent = `Hola, ${usuariActual}!`;
        actualitzarBotonsNivell();
    } catch (error) {
        console.error("Error en descarregar historial, usant dades locals:", error);
        ui.elements.menuBenvinguda.textContent = `Hola, ${usuariActual}! (mode offline)`;
        actualitzarBotonsNivell();
    }
}

function processarDadesServidor(historial) {
    let dades = {
        estadistiques: { multiplicacions: [], sumes: [], restes: [] },
        nivells: { sumes: 0, restes: 0 }, ratxes: { sumes: 0, restes: 0 }
    };
    const historialNormalitzat = historial.map(s => ({
        tipus: s.tipus, errades: s.errades, data: s.data, temps: s.temps,
        encerts: s.encerts != null ? s.encerts : (s.totalpreguntes - s.errades),
        totalPreguntes: s.totalpreguntes
    }));
    historialNormalitzat.forEach(sessio => {
        const { tipus, errades } = sessio;
        if (tipus === 'sumes' || tipus === 'restes') {
            const maxNivell = (tipus === 'sumes' ? nivellsSuma.length : nivellsResta.length) - 1;
            if (errades === 0) {
                dades.ratxes[tipus]++;
                if (dades.ratxes[tipus] >= 3 && dades.nivells[tipus] < maxNivell) {
                    dades.nivells[tipus]++;
                    dades.ratxes[tipus] = 0;
                }
            } else { dades.ratxes[tipus] = 0; }
        }
        if (dades.estadistiques[tipus]) dades.estadistiques[tipus].push(sessio);
    });
    setDadesUsuari(dades);
}

function crearUsuariNou() {
    const nom = ui.elements.nouUsuariNom.value.trim();
    if (!nom) return alert("Si us plau, escriu un nom.");
    if (!usuarisCarregats.includes(nom)) {
        usuarisCarregats.push(nom);
        localStorage.setItem('dojoUsuaris', JSON.stringify(usuarisCarregats));
    }
    ui.elements.nouUsuariNom.value = '';
    iniciarSessioUsuari(nom);
}

function canviarUsuari() {
    usuariActual = null; carregarUsuaris(); mostrarPantalla('login');
}

function getDadesUsuari() {
    return JSON.parse(localStorage.getItem(`dojoDades_${usuariActual}`)) || {
        estadistiques: { multiplicacions: [], sumes: [], restes: [] },
        nivells: { sumes: 0, restes: 0 }, ratxes: { sumes: 0, restes: 0 }
    };
}

function setDadesUsuari(dades) {
    localStorage.setItem(`dojoDades_${usuariActual}`, JSON.stringify(dades));
}
