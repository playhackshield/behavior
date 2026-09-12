let classId = null;
let className = "";
let contestants = []; // { naam, groep }
let games = [];       // { naam, url, id? }

// Start
document.addEventListener('DOMContentLoaded', () => {
    // URL params
    const urlParams = new URLSearchParams(window.location.search);
    classId = urlParams.get('classId');
    
    if (!classId) {
        alert("Geen klas gevonden");
        window.location.href = "selection.html";
        return;
    }

    // Update user banner
    auth.onAuthStateChanged((user) => {
        if (user) {
            document.getElementById('userBanner').style.display = 'flex';
            document.getElementById('currentUserEmail').textContent = user.email;
        } else {
            window.location.href = "index.html";
        }
    });

    // Laad alles
    loadClassName();
    loadStudentsIntoContestants();
    loadGames();
});

// Terug
function backToSelection() {
    window.location.href = "selection.html";
}

// Uitloggen
function logout() {
    if (confirm("Weet je zeker dat je wilt uitloggen?")) {
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    }
}

// Laad de klasnaam
function loadClassName() {
    db.collection("classes").doc(classId).get()
        .then((doc) => {
            if (doc.exists) {
                className = doc.data().name;
                document.getElementById('classNameTitle').textContent = className;
            }
        })
        .catch((error) => console.error("Fout bij laden klasnaam:", error));
}

// Laad leerlingen van de klas als deelnemers
function loadStudentsIntoContestants() {
    db.collection("students")
        .where("classId", "==", classId)
        .orderBy("lastName")
        .get()
        .then((snapshot) => {
            contestants = [];
            snapshot.forEach((doc) => {
                const s = doc.data();
                contestants.push({
                    naam: `${s.firstName} ${s.lastName}`,
                    groep: 0
                });
            });
            renderContestants();
        })
        .catch((error) => console.error("Fout bij laden leerlingen:", error));
}

// Render deelnemerslijst
function renderContestants() {
    const container = document.getElementById('contestantsList');
    container.innerHTML = '';

    if (contestants.length === 0) {
        container.innerHTML = '<p style="color:#888;">Nog geen deelnemers.</p>';
        return;
    }

    contestants.forEach((c, index) => {
        const row = document.createElement('div');
        row.className = 'contestant-row';
        row.innerHTML = `
            <input type="text" class="contestant-name" value="${escapeHtml(c.naam)}" 
                   onchange="updateContestantName(${index}, this.value)" placeholder="Naam">
            <select class="contestant-group" onchange="updateContestantGroup(${index}, this.value)">
                <option value="0" ${c.groep == 0 ? 'selected' : ''}>0</option>
                <option value="1" ${c.groep == 1 ? 'selected' : ''}>1</option>
                <option value="2" ${c.groep == 2 ? 'selected' : ''}>2</option>
            </select>
            <button class="delete-btn" onclick="removeContestant(${index})" title="Verwijder">✖</button>
        `;
        container.appendChild(row);
    });
}

// Naam van een deelnemer wijzigen
function updateContestantName(index, value) {
    contestants[index].naam = value.trim();
}

// Groep van een deelnemer wijzigen
function updateContestantGroup(index, value) {
    contestants[index].groep = parseInt(value);
}

// Verwijder een deelnemer (alleen uit de lijst op scherm)
function removeContestant(index) {
    contestants.splice(index, 1);
    renderContestants();
}

// Voeg een lege regel toe
function addContestantRow() {
    contestants.push({ naam: "", groep: 0 });
    renderContestants();
}

// ---------- SPELLEN ----------

// Laad spellen uit Firebase; maak aan met voorbeelden als leeg
function loadGames() {
    db.collection("spelletjes").get()
        .then((snapshot) => {
            if (snapshot.empty) {
                // Maak de 2 voorbeeldspellen aan
                const voorbeelden = [
                    { naam: "Wachtwoordkluis", url: "https://playhackshield.github.io/leerling/wachtwoord.html" },
                    { naam: "Emoji spinner", url: "https://playhackshield.github.io/leerling/emojispinner.html" }
                ];
                const batch = db.batch();
                voorbeelden.forEach((spel) => {
                    const ref = db.collection("spelletjes").doc();
                    batch.set(ref, spel);
                });
                return batch.commit().then(() => loadGames()); // herlaad
            } else {
                games = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    games.push({
                        id: doc.id,
                        naam: data.naam || "",
                        url: data.url || ""
                    });
                });
                renderGames();
            }
        })
        .catch((error) => console.error("Fout bij laden spellen:", error));
}

// Render spellenlijst
function renderGames() {
    const container = document.getElementById('gamesList');
    container.innerHTML = '';

    if (games.length === 0) {
        container.innerHTML = '<p style="color:#888;">Nog geen spellen.</p>';
        return;
    }

    games.forEach((g, index) => {
        const row = document.createElement('div');
        row.className = 'contestant-row';
        row.innerHTML = `
            <input type="text" class="game-name" value="${escapeHtml(g.naam)}"
                   onchange="updateGameName(${index}, this.value)" placeholder="Naam spel">
            <input type="text" class="game-url" value="${escapeHtml(g.url)}"
                   onchange="updateGameUrl(${index}, this.value)" placeholder="URL">
            <button class="delete-btn" onclick="removeGame(${index})" title="Verwijder">✖</button>
        `;
        container.appendChild(row);
    });
}

function updateGameName(index, value) {
    games[index].naam = value.trim();
}

function updateGameUrl(index, value) {
    games[index].url = value.trim();
}

// Verwijder spel (uit de lijst en uit Firebase)
function removeGame(index) {
    const game = games[index];
    if (!game) return;

    if (confirm(`Weet je zeker dat je "${game.naam}" wilt verwijderen?`)) {
        // Als het spel al een ID heeft (bestaand in Firebase), verwijder het daar ook
        if (game.id) {
            db.collection("spelletjes").doc(game.id).delete()
                .then(() => {
                    games.splice(index, 1);
                    renderGames();
                })
                .catch((error) => {
                    console.error("Fout bij verwijderen spel:", error);
                    alert("Fout: " + error.message);
                });
        } else {
            // Nieuw spel dat nog niet in Firebase staat; alleen uit lijst
            games.splice(index, 1);
            renderGames();
        }
    }
}

// Voeg een leeg spel toe (komt pas in Firebase bij exporteren als het geen id heeft)
function addGameRow() {
    games.push({ naam: "", url: "", id: null });
    renderGames();
}

// ---------- EXPORT ----------

// Exporteer alles
function exportData() {
    // Valideer: geen lege namen/urls
    const leeg = contestants.find(c => !c.naam);
    if (leeg) {
        alert("Vul alle namen van de deelnemers in.");
        return;
    }

    const leegSpel = games.find(g => !g.naam || !g.url);
    if (leegSpel) {
        alert("Vul alle spelnamen en URLs in.");
        return;
    }

    // 1. Leerlingen naar "contestants" (één document, wordt overschreven)
    const exportObj = {
        leerlingen: contestants.map(c => ({
            naam: c.naam,
            groep: c.groep
        })),
        spellen: games.map(g => ({
            naam: g.naam,
            url: g.url
        }))
    };

    // 2. Nieuwe spellen (zonder id) naar "spelletjes" collectie
    const nieuweSpellen = games.filter(g => !g.id);

    const belofteSpellen = nieuweSpellen.map((spel) => {
        return db.collection("spelletjes").add({
            naam: spel.naam,
            url: spel.url
        });
    });

    // 3. Bestaande spellen updaten (naam/url kunnen zijn gewijzigd)
    const bestaandeSpellen = games.filter(g => g.id);
    const belofteUpdates = bestaandeSpellen.map((spel) => {
        return db.collection("spelletjes").doc(spel.id).update({
            naam: spel.naam,
            url: spel.url
        });
    });

    // 4. Alles uitvoeren
    Promise.all([...belofteSpellen, ...belofteUpdates])
        .then(() => {
            // Nu het contestants-document overschrijven
            // Zoek bestaand document in "contestants" (max 1)
            return db.collection("contestants").get();
        })
        .then((snapshot) => {
            if (snapshot.empty) {
                // Maak nieuw document aan
                return db.collection("contestants").add({
                    ...exportObj,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // Overschrijf het bestaande document
                const docId = snapshot.docs[0].id;
                return db.collection("contestants").doc(docId).set({
                    ...exportObj,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        })
        .then(() => {
            alert("Export voltooid! Deelnemers en spellen zijn opgeslagen.");
            // Herlaad spellen zodat nieuwe spellen nu een ID hebben
            loadGames();
        })
        .catch((error) => {
            console.error("Fout bij exporteren:", error);
            alert("Fout bij exporteren: " + error.message);
        });
}

// Hulpfunctie om HTML te escapen
function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
