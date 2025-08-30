// URL CORRECTA del teu Google Sheet publicat com a CSV
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ08s3soO6nF4jR3sAGJ91aTR2a3w_T4iS2-G4LwL3sUa2wd0mea-k2EUOFhMZxIlwep2z/pub?gid=0&single=true&output=csv';

/**
 * Mostra els botons per seleccionar un usuari a la pantalla principal.
 * @param {Array<Object>} llistaUsuaris - La llista d'usuaris a mostrar.
 */
function mostrarBotonsUsuari(llistaUsuaris) {
  const contenidorUsuaris = document.getElementById('user-selection');
  contenidorUsuaris.innerHTML = ''; // Neteja el missatge "Carregant..."

  llistaUsuaris.forEach(usuari => {
    if (usuari && usuari.nom) {
      const boto = document.createElement('button');
      boto.textContent = usuari.nom;
      boto.className = 'user-button';
      boto.onclick = () => seleccionarUsuari(usuari.nom);
      contenidorUsuaris.appendChild(boto);
    }
  });
}

/**
 * Carrega els usuaris des del Google Sheet o, si falla, des del fitxer local usuaris.js.
 */
async function carregarUsuaris() {
  try {
    const response = await fetch(SHEET_URL);
    if (!response.ok) {
      throw new Error('Error en la resposta de la xarxa');
    }
    const data = await response.text();
    const usuarisSheet = Papa.parse(data, { header: true }).data;
    
    const usuarisFiltrats = usuarisSheet.filter(u => u.nom && u.nom.trim() !== '');

    if (usuarisFiltrats.length > 0) {
      mostrarBotonsUsuari(usuarisFiltrats);
    } else {
      throw new Error('No s\'han trobat usuaris vàlids al CSV');
    }
  } catch (error) {
    console.error('Error en carregar usuaris del Sheet, usant còpia local:', error);
    // Comprovem si la variable 'usuaris' del fitxer local usuaris.js existeix
    if (typeof usuaris !== 'undefined') {
      mostrarBotonsUsuari(usuaris);
    } else {
      console.error('La variable local "usuaris" no està definida. Assegura\'t que usuaris.js es carrega correctament abans d\'api.js a l\'index.html.');
      document.getElementById('user-selection').textContent = 'Error crític: no s\'han pogut carregar els usuaris locals.';
    }
  }
}

// TODO: Funció per desar els resultats (a implementar)
function desarResultat(resultat) {
  console.log('Desant resultat (funcionalitat pendent):', resultat);
}

// Inicia la càrrega d'usuaris
carregarUsuaris();
