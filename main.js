// Variables globals del joc
let usuariActual = null;
let puntuacio = 0;
let tempsRestant = 60; // 60 segons per partida
let timerId = null;
let operacioActual = { num1: 0, num2: 0, solucio: 0 };

// Espera que tot el HTML estigui carregat
document.addEventListener('DOMContentLoaded', () => {
  // Amaga les pantalles que no es necessiten al principi
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('new-user-form').style.display = 'none';

  // Assigna esdeveniments als botons
  document.getElementById('new-user-button').addEventListener('click', crearUsuariNou);
  document.getElementById('save-user-button').addEventListener('click', desarUsuariNou);
  
  // Assigna esdeveniment per enviar resposta amb la tecla Enter
  document.getElementById('answer-form').addEventListener('submit', (event) => {
    event.preventDefault(); // Evita que la pàgina es recarregui
    comprovarResposta();
  });
});

// --- Funcions de Gestió d'Usuaris ---

function crearUsuariNou() {
  document.getElementById('user-selection-screen').style.display = 'none';
  document.getElementById('new-user-form').style.display = 'block';
  document.getElementById('new-user-name').focus();
}

function desarUsuariNou() {
  const nomUsuari = document.getElementById('new-user-name').value.trim();
  if (nomUsuari) {
    seleccionarUsuari(nomUsuari);
  } else {
    alert('Per favor, introdueix un nom.');
  }
}

function seleccionarUsuari(nom) {
  usuariActual = nom;
  console.log(`Usuari seleccionat: ${usuariActual}`);

  // Canvia de pantalla
  document.getElementById('user-selection-screen').style.display = 'none';
  document.getElementById('new-user-form').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';

  // Comença el joc
  iniciarJoc();
}

// --- Lògica Principal del Joc ---

function iniciarJoc() {
  // Reinicia valors
  puntuacio = 0;
  tempsRestant = 60;
  document.getElementById('score').textContent = puntuacio;
  document.getElementById('timer').textContent = tempsRestant;

  // Inicia el compte enrere
  timerId = setInterval(actualitzarComptador, 1000);
  
  // Genera la primera operació
  generarOperacio();
}

function generarOperacio() {
  operacioActual.num1 = Math.floor(Math.random() * 10) + 1;
  operacioActual.num2 = Math.floor(Math.random() * 10) + 1;
  operacioActual.solucio = operacioActual.num1 * operacioActual.num2;

  document.getElementById('problem').textContent = `${operacioActual.num1} x ${operacioActual.num2} = ?`;
  document.getElementById('answer').value = '';
  document.getElementById('answer').focus();
  document.getElementById('feedback').textContent = '';
}

function comprovarResposta() {
  const respostaUsuari = parseInt(document.getElementById('answer').value, 10);

  if (respostaUsuari === operacioActual.solucio) {
    puntuacio++;
    document.getElementById('feedback').textContent = 'Correcte!';
    document.getElementById('feedback').style.color = 'green';
  } else {
    document.getElementById('feedback').textContent = `Incorrecte. La resposta era ${operacioActual.solucio}`;
    document.getElementById('feedback').style.color = 'red';
  }
  
  document.getElementById('score').textContent = puntuacio;
  
  // Genera la següent pregunta immediatament
  setTimeout(() => {
    generarOperacio();
  }, 500); // Espera 0.5 segons per mostrar el feedback
}

function actualitzarComptador() {
  tempsRestant--;
  document.getElementById('timer').textContent = tempsRestant;

  if (tempsRestant <= 0) {
    aturarJoc();
  }
}

function aturarJoc() {
  clearInterval(timerId); // Atura el temporitzador
  alert(`Temps esgotat! La teva puntuació final és: ${puntuacio}`);

  const resultat = {
    nom: usuariActual,
    puntuacio: puntuacio,
    data: new Date().toISOString()
  };
  
  desarResultat(resultat);

  // Recarrega la pàgina per tornar a la selecció d'usuari
  window.location.reload();
}
