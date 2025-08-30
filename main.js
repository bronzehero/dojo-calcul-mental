document.addEventListener('DOMContentLoaded', () => {
  // Amaga les pantalles que no es necessiten al principi
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('new-user-form').style.display = 'none';

  // Assigna l'esdeveniment al botó de crear nou usuari
  document.getElementById('new-user-button').addEventListener('click', crearUsuariNou);

  // Assigna l'esdeveniment al botó de desar el nou usuari
  document.getElementById('save-user-button').addEventListener('click', desarUsuariNou);
});

let usuariActual = null;

/**
 * Funció que s'executa quan es fa clic al botó "Crear usuari nou".
 * Amaga la selecció d'usuaris i mostra el formulari per al nou nom.
 */
function crearUsuariNou() {
  document.getElementById('user-selection-screen').style.display = 'none';
  document.getElementById('new-user-form').style.display = 'block';
  document.getElementById('new-user-name').focus(); // Posa el focus a l'input
}

/**
 * Funció que desa el nom del nou usuari i comença el joc.
 */
function desarUsuariNou() {
    const nomUsuari = document.getElementById('new-user-name').value.trim();
    if (nomUsuari) {
        seleccionarUsuari(nomUsuari);
    } else {
        alert('Per favor, introdueix un nom.');
    }
}

/**
 * Funció que s'executa quan un usuari és seleccionat.
 * @param {string} nom - El nom de l'usuari seleccionat.
 */
function seleccionarUsuari(nom) {
  usuariActual = nom;
  console.log(`Usuari seleccionat: ${usuariActual}`);

  // Amaga la pantalla de selecció d'usuari
  document.getElementById('user-selection-screen').style.display = 'none';
  document.getElementById('new-user-form').style.display = 'none';

  // Mostra la pantalla del joc
  document.getElementById('game-screen').style.display = 'block';

  // TODO: Aquí aniria la lògica per iniciar el joc (ex: iniciarComptador, generarOperacio, etc.)
  alert(`Benvingut/da, ${usuariActual}! El joc està a punt per començar.`);
}

// TODO: Resta de la lògica del joc (generar operacions, comprovar resultats, etc.)```
