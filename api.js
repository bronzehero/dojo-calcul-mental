// URL del teu Google Sheet publicat com a CSV
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ08s3soO6nF4jR3sAGJ91aarrow_forwardTR2a3w_T4iS2-G4LwL3sUa2wd0mea-k2EUOFhMZxIlwep2z/pub?gid=0&single=true&output=csv';

/**
 * Mostra els botons per seleccionar un usuari a la pantalla principal.
 * Aquesta funció s'integra amb l'element <div id="user-selection"> de l'index.html
 * i crida a la funció seleccionarUsuari(nom) definida a main.js.
 * @param {Array<Object>} usuaris - La llista d'usuaris a mostrar.
 */
function mostrarBotonsUsuari(usuaris) {
  const contenidorUsuaris = document.getElementById('user-selection');

  // Neteja el missatge "Carregant usuaris..."
  contenidorUsuaris.innerHTML = '';

  // Crea un botó per cada usuari
  usuaris.forEach(usuari => {
    // Assegurem que l'usuari tingui un nom abans de crear el botó
    if (usuari && usuari.nom) {
      const boto = document.createElement('button');
      boto.textContent = usuari.nom;
      boto.className = 'user-button'; // Pots afegir una classe per estils
      
      // Quan es fa clic, crida a la funció de main.js per iniciar el procés
      boto.onclick = () => seleccionarUsuari(usuari.nom);
      
      contenidorUsuaris.appendChild(boto);
    }
  });
}

/**
 * Carrega els usuaris des del Google Sheet.
 * Si falla, carrega els usuaris des del fitxer local usuaris.js com a fallback.
 */
async function carregarUsuaris() {
  try {
    const response = await fetch(SHEET_URL);
    if (!response.ok) {
      throw new Error('Error en la resposta de la xarxa');
    }
    const data = await response.text();
    const usuarisSheet = Papa.parse(data, { header: true }).data.map(row => ({ nom: row.nom }));
    
    // Filtrem usuaris sense nom que poden venir de files buides a l'spreadsheet
    const usuarisFiltrats = usuarisSheet.filter(u => u.nom && u.nom.trim() !== '');

    if (usuarisFiltrats.length > 0) {
        mostrarBotonsUsuari(usuarisFiltrats);
    } else {
        // Si el CSV està buit o mal format, fem servir la còpia local
        throw new Error('No s\'han trobat usuaris vàlids al CSV');
    }
  } catch (error) {
    console.error('Error en carregar usuaris del Sheet, usant còpia local:', error);
    // La variable 'usuaris' ve del fitxer usuaris.js que s'importa a l'index.html
    mostrarBotonsUsuari(usuaris); 
  }
}

// TODO: Funció per desar els resultats (a implementar)
function desarResultat(resultat) {
  // Aquí anirà la lògica per enviar les dades al Google Sheet mitjançant Google Apps Script
  console.log('Desant resultat (funcionalitat pendent):', resultat);
  // Hauràs de fer una petició POST a la URL de la teva Web App de Google Apps Script
}

// Inicia la càrrega d'usuaris quan l'script es carrega
carregarUsuaris();
