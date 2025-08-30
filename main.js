document.addEventListener('DOMContentLoaded', () => {
    // --- Event Listeners ---
    ui.buttons.crearUsuari.addEventListener('click', crearUsuariNou);
    ui.buttons.canviarUsuari.addEventListener('click', canviarUsuari);
    ui.buttons.multiplicacions.addEventListener('click', () => iniciarJoc('multiplicacions'));
    ui.buttons.sumes.addEventListener('click', () => iniciarJoc('sumes'));
    ui.buttons.restes.addEventListener('click', () => iniciarJoc('restes'));
    ui.buttons.estadistiques.addEventListener('click', () => { mostrarPantalla('estadistiques'); mostrarEstadistiquesGlobals(); ui.elements.historialDetallat.style.display = 'none'; });
    ui.elements.respostaInput.addEventListener('input', () => { ui.buttons.comprovar.disabled = ui.elements.respostaInput.value.trim() === ''; });
    ui.elements.respostaInput.addEventListener('keyup', (e) => { if (e.key === 'Enter' && !ui.buttons.comprovar.disabled) comprovarResposta(); });
    ui.buttons.comprovar.addEventListener('click', comprovarResposta);
    ui.buttons.finalitzar.forEach(btn => btn.addEventListener('click', () => {
        if (confirm("Segur que vols sortir de la sessió? El progrés no es desarà.")) { finalitzarSessio(false); }
    }));
    ui.buttons.tornarMenu.addEventListener('click', () => mostrarPantalla('menuPrincipal'));
    ui.buttons.tornarMenuStats.addEventListener('click', () => mostrarPantalla('menuPrincipal'));
    ui.buttons.historial.forEach(btn => btn.addEventListener('click', () => mostrarHistorial(btn.dataset.tipus)));

    // --- Inicialització ---
    carregarUsuaris();
    mostrarPantalla('login');
});

function obtenirNivell(tipus) { return getDadesUsuari().nivells[tipus] || 0; }

function actualitzarNivell(tipus, senseErrades) {
    if (tipus !== 'sumes' && tipus !== 'restes') return;
    const dadesUsuari = getDadesUsuari();
    const maxNivell = (tipus === 'sumes' ? nivellsSuma.length : nivellsResta.length) - 1;
    if (senseErrades) {
        dadesUsuari.ratxes[tipus]++;
        if (dadesUsuari.ratxes[tipus] >= 3 && dadesUsuari.nivells[tipus] < maxNivell) {
            dadesUsuari.nivells[tipus]++;
            dadesUsuari.ratxes[tipus] = 0;
        }
    } else { dadesUsuari.ratxes[tipus] = 0; }
    setDadesUsuari(dadesUsuari);
}

function actualitzarBotonsNivell() {
    const dadesUsuari = getDadesUsuari();
    const progresSuma = (dadesUsuari.ratxes.sumes / 3) * 100;
    const nivellSuma = dadesUsuari.nivells.sumes + 1;
    ui.buttons.sumes.style.background = `linear-gradient(to right, #ffafcc ${progresSuma}%, var(--c-blue) ${progresSuma}%)`;
    ui.buttons.sumes.innerHTML = `Sumes <br>(Nivell ${nivellSuma}/${nivellsSuma.length})`;
    const progresResta = (dadesUsuari.ratxes.restes / 3) * 100;
    const nivellResta = dadesUsuari.nivells.restes + 1;
    ui.buttons.restes.style.background = `linear-gradient(to right, #ffafcc ${progresResta}%, var(--c-green) ${progresResta}%)`;
    ui.buttons.restes.innerHTML = `Restes <br>(Nivell ${nivellResta}/${nivellsResta.length})`;
}

function mostrarEstadistiquesGlobals() {
    const dadesUsuari = getDadesUsuari();
    const totesLesSessions = Object.values(dadesUsuari.estadistiques).flat();
    if (totesLesSessions.length === 0) {
        ui.elements.statsGlobals.innerHTML = `<h3>Resum General (${usuariActual})</h3><p>No hi ha dades.</p>`; return;
    }
    const totalSessions = totesLesSessions.length;
    const totalEncerts = totesLesSessions.reduce((s, a) => s + (a.encerts || 0), 0);
    const totalPreguntes = totesLesSessions.reduce((s, a) => s + (a.totalPreguntes || 0), 0);
    const precisio = totalPreguntes > 0 ? ((totalEncerts / totalPreguntes) * 100).toFixed(1) : 0;
    const tempsTotal = totesLesSessions.reduce((s, a) => s + a.temps, 0);
    const tempsMitja = (tempsTotal / totalSessions).toFixed(1);
    ui.elements.statsGlobals.innerHTML = `<h3>Resum General (${usuariActual})</h3><div class="stats-grid"><div class="stat-item"><div>Sessions</div><div class="value">${totalSessions}</div></div><div class="stat-item"><div>Precisió</div><div class="value">${precisio}%</div></div><div class="stat-item"><div>Temps Mitjà</div><div class="value">${tempsMitja}s</div></div></div>`;
}

function mostrarHistorial(tipus) {
    const historial = getDadesUsuari().estadistiques[tipus] || [];
    ui.elements.historialTitol.textContent = `Historial de ${tipus}`;
    ui.elements.historialContingut.innerHTML = '';
    if (historial.length === 0) {
        ui.elements.historialContingut.innerHTML = '<p>Encara no hi ha dades.</p>';
        if (chartInstances.errors) { chartInstances.errors.destroy(); chartInstances.errors = null; }
        if (chartInstances.times) { chartInstances.times.destroy(); chartInstances.times = null; }
    } else {
        historial.slice().reverse().forEach(s => {
            const p = document.createElement('p');
            p.textContent = `${s.data} - Errades: ${s.errades}, Temps: ${s.temps}s`;
            ui.elements.historialContingut.appendChild(p);
        });
        generarGrafiques(historial);
    }
    ui.elements.historialDetallat.style.display = 'block';
}

function generarGrafiques(dades) {
    if (chartInstances.errors) chartInstances.errors.destroy();
    if (chartInstances.times) chartInstances.times.destroy();
    const labels = dades.map((s, i) => `${s.data} (#${i+1})`);
    const erradesData = dades.map(s => s.errades);
    const tempsData = dades.map(s => s.temps);
    const errCtx = document.getElementById('errors-chart').getContext('2d');
    chartInstances.errors = new Chart(errCtx, { type: 'line', data: { labels: labels, datasets: [{ label: 'Errades per sessió', data: erradesData, borderColor: 'rgba(255, 99, 132, 1)', backgroundColor: 'rgba(255, 99, 132, 0.2)', fill: true, tension: 0.1 }] }, options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } } });
    const timesCtx = document.getElementById('times-chart').getContext('2d');
    chartInstances.times = new Chart(timesCtx, { type: 'line', data: { labels: labels, datasets: [{ label: 'Temps per sessió (segons)', data: tempsData, borderColor: 'rgba(54, 162, 235, 1)', backgroundColor: 'rgba(54, 162, 235, 0.2)', fill: true, tension: 0.1 }] }, options: { scales: { y: { beginAtZero: true } } } });
}
