# Dojo de Càlcul Mental

## 🌟 Visió General

El **Dojo de Càlcul Mental** és una aplicació web dissenyada per ajudar nens i nenes a practicar operacions matemàtiques bàsiques (sumes, restes i multiplicacions) d'una manera divertida, intuïtiva i eficaç.

L'aplicació compta amb un sistema d'aprenentatge adaptatiu que reforça les operacions fallades, un sistema de progressió per nivells, i la persistència de dades al núvol per a poder jugar des de qualsevol dispositiu sense perdre el progrés.

## 🚀 Característiques Principals

*   **Gestió d'Usuaris:** Cada jugador té el seu propi perfil, on es desa el seu progrés i estadístiques de manera independent.
*   **Aprenentatge Adaptatiu:** El joc identifica les operacions fallades i les repeteix de manera intel·ligent fins que l'usuari les domina.
*   **Progressió per Nivells:** Les sumes i restes estan organitzades en nivells de dificultat creixent. L'usuari avança de nivell demostrant consistència.
*   **Dades al Núvol:** Totes les dades es guarden de forma segura en un Google Sheet, permetent l'accés des de qualsevol dispositiu.
*   **Estadístiques Detallades:** Un panell d'estadístiques mostra un resum global i un historial detallat amb gràfiques per a cada tipus d'operació.
*   **Disseny "Pop Mart":** La interfície està dissenyada amb una estètica alegre i moderna, inspirada en "Pop Mart", per a fer l'experiència més atractiva.

## 🧠 Regles del Joc i Lògica d'Aprenentatge

### Lògica General de les Sessions

El nucli del joc és el sistema de domini de les preguntes.

1.  **Objectiu:** L'objectiu de cada sessió és "dominar" totes les operacions presentades.
2.  **Domini d'una Pregunta:** Una operació es considera dominada quan s'encerta **3 cops consecutius**.
3.  **Sistema de Repetició (Pregunta-Pont):**
    *   Si un usuari **falla** una operació (pregunta A), el joc li mostra la resposta correcta.
    *   A continuació, el joc presenta una "pregunta-pont" (pregunta B) de la llista.
    *   Immediatament després de respondre la pregunta B (correctament o no), el joc torna a presentar la pregunta A.
    *   El comptador d'encerts consecutius per a la pregunta A es reinicia a 0 cada cop que es falla.
4.  **Final de la Sessió:** Una sessió només acaba quan s'han dominat (3 encerts seguits) totes les operacions que es van presentar inicialment.

### Sumes

*   **Nivells:** Hi ha 7 nivells de dificultat creixent, començant amb operacions amb números del 0 al 4.
*   **Generació de Preguntes:** Cada sessió inclou **totes les combinacions úniques** possibles per al rang de números del nivell actual. Per exemple, inclourà `2+3` i `3+2`, però només un cop `3+3`.
*   **Pujar de Nivell:** Per pujar de nivell, l'usuari ha de completar **3 sessions perfectes seguides** (sense cap errada inicial).
*   **Indicador Visual:** El botó de "Sumes" al menú principal mostra un indicador visual de la ratxa actual per pujar de nivell.

### Restes

*   **Nivells:** Igual que les sumes, hi ha 7 nivells de dificultat.
*   **Generació de Preguntes:** Es generen totes les combinacions on el resultat és igual o superior a zero.
*   **Pujar de Nivell:** La lògica és idèntica a la de les sumes: 3 sessions perfectes seguides.

### Taules de Multiplicar

*   **Sessió Única:** A diferència de les sumes i restes, les multiplicacions no tenen nivells. Cada sessió és una pràctica completa.
*   **Generació de Preguntes:** La sessió inclou **totes les combinacions úniques de les taules del 2 al 9**. Això inclou `6x7` i `7x6`, però només un cop `7x7`. L'ordre de les preguntes és sempre aleatori.

## 📊 Gestió d'Usuaris i Dades

1.  **Inici de Sessió:** La primera pantalla sempre demana "Qui està jugant?". L'usuari pot seleccionar un perfil existent o crear-ne un de nou.
2.  **Persistència d'Usuaris:** La llista d'usuaris es carrega directament des del Google Sheet, garantint que estigui disponible des de qualsevol dispositiu.
3.  **Dades per Usuari:** Tot el progrés (nivells, ratxes i historial d'estadístiques) es guarda de forma local i remota associat a l'usuari actiu.
4.  **Integritat de les Dades:**
    *   Una sessió **només es desa si es completa**. Si l'usuari surt a mitja partida, aquesta no compta a les estadístiques.
    *   Les dades es guarden automàticament en el moment de respondre l'última pregunta de la sessió.

## 📈 Pantalla d'Estadístiques

*   **Resum General:** Mostra una targeta amb mètriques globals per a l'usuari actiu:
    *   Total de sessions completades.
    *   Precisió general (percentatge d'encerts sobre el total de preguntes).
    *   Temps mitjà per sessió.
*   **Historial Detallat:** L'usuari pot seleccionar veure l'historial de Sumes, Restes o Multiplicacions. Aquesta vista mostra:
    *   **Dues Gràfiques de Línies:** Una per a l'evolució de les **errades** i una altra per a l'evolució dels **temps** al llarg de les sessions.
    *   **Llista Històrica:** Un llistat de totes les sessions completades, amb la data, el nombre d'errades i el temps emprat.

## 📱 Requeriments Tècnics i d'Usabilitat

*   **Enfocament Mòbil/Tàctil:** El disseny està optimitzat per a dispositius com l'iPad.
*   **Teclat Numèric:** En els camps de resposta, s'invoca automàticament el teclat numèric (`inputmode="numeric"`).
*   **Interfície Reactiva:** El botó de "Comprovar" està desactivat si no hi ha cap número introduït per evitar enviaments accidentals.
*   **Idioma:** Tota la interfície està en català.
