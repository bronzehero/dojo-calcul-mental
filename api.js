// URL CORRECTA del teu Google Sheet publicat com a CSV
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ08s3soO6nF4jR3sAGJ91aTR2a3w_T4iS2-G4LwL3sUa2wd0mea-k2EUOFhMZxIlwep2z/pub?gid=0&single=true&output=csv';

// Llista d'usuaris local com a fallback si falla la connexió amb el Google Sheet
const usuarisLocals = [
  { nom: 'Anna' },
  { nom: 'Carles' },
  { nom: 'Berta' }
];

/**
 * Mostra els botons per seleccionar un usuari a la pantalla principal.
 * @param {Array<Object>} llistaUsuaris - La llista d'usuaris a mostrar.
 */
function mostrarBotonsUsuari(llistaUsuaris) {
  const contenidorUsuaris = document.getElementById('user-selection');
  contenidorUsuaris.innerHTML = ''; // Neteja el missatge "Carregant..."

  llistaUsuaris.forEach(usuari => {
    if (usuari && usuari.nom && usuari.nom.trim() !== '') {
      const boto = document.createElement('button');
      boto.textContent = usuari.nom;
      boto.className = 'user-button';
      boto.onclick = () => seleccionarUsuari(usuari.nom);
      contenidorUsuaris.appendChild(boto);
    }
  });
}

/**
 * Carrega els usuaris des del Google Sheet o, si falla, des de la llista local.
 */
async function carregarUsuaris() {
  try {
    const response = await fetch(SHEET_URL);
    if (!response.ok) {
      throw new Error('Error en la resposta de la xarxa');
    }
    const data = await response.text();
    const usuarisSheet = Papa.parse(data, { header: true }).data;
    
    if (usuarisSheet.length > 0) {
      mostrarBotonsUsuari(usuarisSheet);
    } else {
      throw new Error('El CSV està buit o mal format');
    }
  } catch (error) {
    console.error('Error en carregar usuaris del Sheet, usant còpia local:', error);
    mostrarBotonsUsuari(usuarisLocals);
  }
}

/**
 * Funció per desar els resultats (placeholder).
 * @param {Object} resultat - Objecte amb nom, puntuació, etc.
 */
function desarResultat(resultat) {
  console.log('Desant resultat (funcionalitat pendent):', resultat);
  // Aquí anirà la lògica per enviar dades al Google Sheet amb Apps Script.
}

// Inicia la càrrega d'usuaris quan l'script es carrega.
carregarUsuaris();
