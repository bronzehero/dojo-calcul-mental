const pantallas = {
    login: document.getElementById('pantalla-login'),
    menuPrincipal: document.getElementById('menu-principal'),
    joc: document.getElementById('pantalla-joc'),
    resum: document.getElementById('pantalla-resum'),
    estadistiques: document.getElementById('pantalla-estadistiques')
};

const ui = {
    buttons: {
        crearUsuari: document.getElementById('btn-crear-usuari'),
        canviarUsuari: document.getElementById('btn-canviar-usuari'),
        multiplicacions: document.getElementById('btn-multiplicacions'),
        sumes: document.getElementById('btn-sumes'),
        restes: document.getElementById('btn-restes'),
        estadistiques: document.getElementById('btn-estadistiques'),
        comprovar: document.getElementById('btn-comprovar'),
        tornarMenu: document.getElementById('btn-tornar-menu'),
        tornarMenuStats: document.getElementById('btn-tornar-menu-stats'),
        historial: document.querySelectorAll('#botons-historial button'),
        finalitzar: document.querySelectorAll('.btn-finalitzar')
    },
    elements: {
        usuarisExistents: document.getElementById('usuaris-existents'),
        nouUsuariNom: document.getElementById('nou-usuari-nom'),
        menuBenvinguda: document.getElementById('menu-benvinguda'),
        jocTitol: document.getElementById('joc-titol'),
        preguntaText: document.getElementById('pregunta-text'),
        respostaInput: document.getElementById('resposta-input'),
        feedbackMissatge: document.getElementById('feedback-missatge'),
        progressBar: document.getElementById('progress-bar'),
        tempsTotal: document.getElementById('temps-total'),
        encerts: document.getElementById('encerts'),
        errades: document.getElementById('errades'),
        missatgeFelicitacio: document.getElementById('missatge-felicitacio'),
        resumTitol: document.getElementById('resum-titol'),
        resumFalladesContenidor: document.getElementById('resum-fallades-contenidor'),
        resumFallades: document.getElementById('resum-fallades'),
        statsGlobals: document.getElementById('stats-globals'),
        historialDetallat: document.getElementById('historial-detallat'),
        historialTitol: document.getElementById('historial-titol'),
        historialContingut: document.getElementById('historial-contingut')
    }
};

function mostrarPantalla(id) {
    Object.values(pantallas).forEach(p => p.style.display = 'none');
    pantallas[id].style.display = 'block';
}

function mostrarFeedback(missatge) {
    const el = ui.elements.feedbackMissatge;
    el.textContent = missatge;
    el.className = 'feedback-incorrecte';
    el.style.display = 'block';
    ui.buttons.comprovar.disabled = true;
    setTimeout(() => {
         ui.buttons.comprovar.disabled = (ui.elements.respostaInput.value.trim() === '');
         seguentPregunta();
    }, 1500);
}
