let estatJoc = {};
let chartInstances = { errors: null, times: null };

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function iniciarJoc(tipus) {
    let preguntesInicials = [];
    let titol = '';
    if (tipus === 'multiplicacions') {
        titol = 'Multiplicacions';
        for (let i = 2; i <= 9; i++) {
            for (let j = i; j <= 9; j++) {
                preguntesInicials.push({ text: `${i} x ${j}`, resposta: i * j });
                if (i !== j) preguntesInicials.push({ text: `${j} x ${i}`, resposta: j * i });
            }
        }
    } else if (tipus === 'sumes') {
        titol = 'Sumes';
        const nivell = nivellsSuma[obtenirNivell('sumes')];
        for (let i = nivell.min; i <= nivell.max; i++) {
            for (let j = i; j <= nivell.max; j++) {
                preguntesInicials.push({ text: `${i} + ${j}`, resposta: i + j });
                if (i !== j) preguntesInicials.push({ text: `${j} + ${i}`, resposta: j + i });
            }
        }
    } else if (tipus === 'restes') {
        titol = 'Restes';
        const nivell = nivellsResta[obtenirNivell('restes')];
        for (let i = nivell.min; i <= nivell.max; i++) {
            for (let j = nivell.min; j <= i; j++) {
                preguntesInicials.push({ text: `${i} - ${j}`, resposta: i - j });
            }
        }
    }
    
    estatJoc = {
        tipus: tipus,
        preguntes: shuffle(preguntesInicials.map(p => ({ ...p, encertsConsecutius: 0, fallada: false }))),
        preguntaActualIndex: 0,
        falladesOriginals: [],
        startTime: new Date(),
        totalPreguntesInicials: preguntesInicials.length,
        preguntesDominades: 0
    };

    ui.elements.jocTitol.textContent = titol;
    mostrarPantalla('joc');
    seguentPregunta();
}

function seguentPregunta() {
    ui.elements.feedbackMissatge.style.display = 'none';
    if (estatJoc.preguntes.length === 0) {
        finalitzarSessio(true);
        return;
    }
    if (estatJoc.preguntaActualIndex >= estatJoc.preguntes.length) {
        estatJoc.preguntaActualIndex = 0;
    }
    const preguntaActual = estatJoc.preguntes[estatJoc.preguntaActualIndex];
    ui.elements.preguntaText.textContent = preguntaActual.text;
    ui.elements.respostaInput.value = '';
    ui.elements.respostaInput.focus();
    actualitzarProgres();
}

function comprovarResposta() {
    if (ui.elements.respostaInput.value.trim() === '') return;
    
    const preguntaActual = estatJoc.preguntes[estatJoc.preguntaActualIndex];
    const respostaUsuari = parseInt(ui.elements.respostaInput.value);

    if (respostaUsuari === preguntaActual.resposta) {
        preguntaActual.encertsConsecutius++;
        if (preguntaActual.encertsConsecutius >= 3) {
            estatJoc.preguntesDominades++;
            estatJoc.preguntes.splice(estatJoc.preguntaActualIndex, 1);
        } else {
            estatJoc.preguntaActualIndex++;
        }
    } else {
        if (!preguntaActual.fallada) {
            estatJoc.falladesOriginals.push({text: preguntaActual.text, resposta: preguntaActual.resposta});
            preguntaActual.fallada = true;
        }
        preguntaActual.encertsConsecutius = 0;
        
        const preguntaFallada = estatJoc.preguntes.splice(estatJoc.preguntaActualIndex, 1)[0];
        const novaPosicio = Math.min(estatJoc.preguntaActualIndex + 1, estatJoc.preguntes.length);
        estatJoc.preguntes.splice(novaPosicio, 0, preguntaFallada);
        
        mostrarFeedback(`Has fallat! La resposta correcta era: ${preguntaActual.resposta}`);
        return;
    }
    seguentPregunta();
}

function actualitzarProgres() {
    const total = estatJoc.totalPreguntesInicials;
    const dominades = estatJoc.preguntesDominades;
    const progres = total > 0 ? (dominades / total) * 100 : 0;
    ui.elements.progressBar.style.width = `${progres}%`;
    ui.elements.progressBar.textContent = `${dominades}/${total}`;
}

function finalitzarSessio(completada) {
    if (completada) {
        const tempsTranscorregut = Math.round((new Date() - estatJoc.startTime) / 1000);
        const erradesInicials = estatJoc.falladesOriginals.length;
        const encertsInicials = estatJoc.totalPreguntesInicials - erradesInicials;

        ui.elements.tempsTotal.textContent = tempsTranscorregut;
        ui.elements.encerts.textContent = encertsInicials;
        ui.elements.errades.textContent = erradesInicials;
        
        if (erradesInicials === 0) {
            ui.elements.resumTitol.textContent = "Increïble!";
            ui.elements.missatgeFelicitacio.style.display = 'block';
            ui.elements.resumFalladesContenidor.style.display = 'none';
            actualitzarNivell(estatJoc.tipus, true);
        } else {
            ui.elements.resumTitol.textContent = "Bon intent!";
            ui.elements.missatgeFelicitacio.style.display = 'none';
            ui.elements.resumFalladesContenidor.style.display = 'block';
            ui.elements.resumFallades.innerHTML = estatJoc.falladesOriginals.map(p => `<p>${p.text} = <strong>${p.resposta}</strong></p>`).join('');
            actualitzarNivell(estatJoc.tipus, false);
        }
        guardarEstadistiques(tempsTranscorregut, encertsInicials, erradesInicials);
        mostrarPantalla('resum');
    } else {
        mostrarPantalla('menuPrincipal');
    }
    actualitzarBotonsNivell();
}

function guardarEstadistiques(temps, encerts, errades) {
    const dadesUsuari = getDadesUsuari();
    const sessioDades = {
        data: new Date().toLocaleDateString('ca-ES'),
        tipus: estatJoc.tipus,
        encerts: encerts, errades: errades, temps: temps,
        totalPreguntes: estatJoc.totalPreguntesInicials
    };
    dadesUsuari.estadistiques[estatJoc.tipus].push(sessioDades);
    setDadesUsuari(dadesUsuari);
    const dadesPerEnviar = { secret: CLAU_SECRETA, usuari: usuariActual, ...sessioDades };
    fetch(URL_APP_SCRIPT, {
        method: 'POST', mode: 'no-cors', cache: 'no-cache',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dadesPerEnviar)
    }).then(() => console.log("Dades enviades.")).catch(e => console.error("Error enviant:", e));
}
