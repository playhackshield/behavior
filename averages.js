// === GLOBALE VARIABELEN ===
let currentBaseName = null;      // bijv. "Olympia"
let classAveragesDocId = null;   // Firestore document ID (indien al bestaat)

// === START: lees className uit URL ===
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const fullClassName = params.get('className');

    if (!fullClassName) {
        showMessage('Geen klasnaam meegegeven. Ga terug en probeer opnieuw.', 'error');
        disableButtons();
        return;
    }

    if (!fullClassName.includes(' - ')) {
        showMessage('Klasnaam moet het format "Schoolnaam - Week X" hebben om gemiddelden te kunnen tonen.', 'error');
        disableButtons();
        document.getElementById('classInfo').textContent = 'Klassenaam: ' + fullClassName;
        return;
    }

    currentBaseName = fullClassName.split(' - ')[0].trim();
    document.getElementById('classInfo').textContent = 'Basisnaam: ' + currentBaseName;

    // Laad bestaande gegevens (indien aanwezig)
    loadExistingAverages(currentBaseName);
});

// === HULPFUNCTIES ===
function showMessage(text, type) {
    const el = document.getElementById('statusMessage');
    el.textContent = text;
    el.className = 'status-message ' + type;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function disableButtons() {
    document.querySelectorAll('.averages-toolbar button').forEach(b => b.disabled = true);
}

function setDefaultEmptyJson() {
    const emptyJson = {
        className: currentBaseName || '',
        numberOfClasses: 0,
        students: []
    };
    document.getElementById('averagesTextarea').value = JSON.stringify(emptyJson, null, 2);
}

// === LADEN VAN BESTAANDE GEMIDDELDEN ===
function loadExistingAverages(baseName) {
    db.collection('classAverages').where('className', '==', baseName).get()
        .then((snapshot) => {
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                classAveragesDocId = doc.id;
                const data = doc.data();

                const displayData = {
                    className: data.className,
                    numberOfClasses: typeof data.numberOfClasses === 'number' ? data.numberOfClasses : 0,
                    students: data.students || []
                };
                document.getElementById('averagesTextarea').value = JSON.stringify(displayData, null, 2);
                showMessage('Bestaande gegevens geladen.', 'success');
            } else {
                // Geen data: leeg veld met minimale JSON
                setDefaultEmptyJson();
            }
        })
        .catch((error) => {
            console.error('Fout bij laden gemiddelden:', error);
            setDefaultEmptyJson();
            showMessage('Fout bij laden bestaande gegevens: ' + error.message, 'error');
        });
}

// === BEREKENEN VAN GEMIDDELDEN ===
function calculateAverages() {
    if (!currentBaseName) return;

    showMessage('Bezig met berekenen...', 'info');

    // Stap 1: alle klassen ophalen met dezelfde basisnaam
    db.collection('classes').get()
        .then((snapshot) => {
            const matchingClassIds = [];
            snapshot.forEach((doc) => {
                const name = doc.data().name || '';
                if (name.split(' - ')[0].trim() === currentBaseName) {
                    matchingClassIds.push(doc.id);
                }
            });
            return matchingClassIds;
        })
        .then((classIds) => {
            if (classIds.length === 0) {
                showMessage('Geen klassen gevonden met basisnaam "' + currentBaseName + '".', 'error');
                return null;
            }

            // Stap 2: alle leerlingen ophalen van die klassen
            // Firestore 'in' query heeft een limiet van 10; we splitsen op in chunks van 10
            const chunks = [];
            for (let i = 0; i < classIds.length; i += 10) {
                chunks.push(classIds.slice(i, i + 10));
            }

            const promises = chunks.map((chunk) => {
                return db.collection('students').where('classId', 'in', chunk).get();
            });

            return Promise.all(promises).then((snapshots) => {
                const allStudents = [];
                snapshots.forEach((s) => {
                    s.forEach((doc) => allStudents.push(doc.data()));
                });
                return {
                    classCount: classIds.length,
                    students: allStudents
                };
            });
        })
        .then((result) => {
            if (result === null) return;

            const allStudents = result.students;
            const numberOfClasses = result.classCount;

// Stap 3: groeperen op firstName
// We houden per leerling bij:
//   - scores: alleen niet-nul currentScore waarden (voor gemiddelde)
//   - classIds: alleen classIds waar de leerling een NIET-NUL score heeft
//              (dus "aanwezig" = beoordeeld met een score anders dan 0)
const grouped = {};
allStudents.forEach((student) => {
    const key = student.firstName;
    if (!grouped[key]) {
        grouped[key] = { scores: [], classIds: new Set() };
    }
    const score = student.currentScore;
    if (typeof score === 'number' && score !== 0) {
        // Niet-nul score: telt mee voor gemiddelde én voor aanwezigheid
        grouped[key].scores.push(score);
        grouped[key].classIds.add(student.classId);
    }
    // Bij score 0: niet meetellen als aanwezig, niet meetellen in gemiddelde
});
            
            // Stap 4: bestaande notes ophalen uit het tekstveld (zodat we die kunnen behouden)
            const existingNotes = {};
            try {
                const currentJson = JSON.parse(document.getElementById('averagesTextarea').value);
                if (currentJson && Array.isArray(currentJson.students)) {
                    currentJson.students.forEach((s) => {
                        existingNotes[s.firstName] = s.notes || '';
                    });
                }
            } catch (e) {
                // Ongeldige JSON in tekstveld: negeren
            }

// Stap 5: gemiddelden berekenen
const students = Object.keys(grouped).map((firstName) => {
    const entry = grouped[firstName];
    const scores = entry.scores;
    let average = null;
    if (scores.length > 0) {
        const sum = scores.reduce((a, b) => a + b, 0);
        average = Math.round((sum / scores.length) * 100) / 100;
    }
    return {
        firstName: firstName,
        average: average,
        notes: existingNotes[firstName] || '',
        numberOfClasses: entry.classIds.size   // ← alleen klassen met niet-nul score
    };
});
            // Sorteer op voornaam
            students.sort((a, b) => a.firstName.localeCompare(b.firstName));

            // Stap 6: tekstveld vullen
            const resultJson = {
                className: currentBaseName,
                numberOfClasses: numberOfClasses,
                students: students
            };
            document.getElementById('averagesTextarea').value = JSON.stringify(resultJson, null, 2);
            showMessage('Gemiddelden berekend. Vergeet niet op te slaan!', 'success');
        })
        .catch((error) => {
            console.error('Fout bij berekenen:', error);
            showMessage('Fout bij berekenen: ' + error.message, 'error');
        });
}

// === OPSLAAN ===
function saveAverages() {
    if (!currentBaseName) return;

    const raw = document.getElementById('averagesTextarea').value;
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        showMessage('Ongeldige JSON. Controleer het tekstveld.', 'error');
        return;
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.students)) {
        showMessage('JSON moet een "students"-array bevatten.', 'error');
        return;
    }

    // Forceer className op basis van de basisnaam (veiligheid)
    parsed.className = currentBaseName;

    // numberOfClasses: neem over uit JSON, of val terug op 0
    const numberOfClasses = typeof parsed.numberOfClasses === 'number' ? parsed.numberOfClasses : 0;

    // Voeg updatedAt toe
    const dataToSave = {
        className: currentBaseName,
        numberOfClasses: numberOfClasses,
        students: parsed.students,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Als we het document al kennen: update. Anders: zoek of maak nieuw.
    if (classAveragesDocId) {
        db.collection('classAverages').doc(classAveragesDocId).set(dataToSave, { merge: false })
            .then(() => showMessage('Opgeslagen!', 'success'))
            .catch((error) => showMessage('Fout bij opslaan: ' + error.message, 'error'));
    } else {
        // Controleer nogmaals of er al een document bestaat (om duplicaten te voorkomen)
        db.collection('classAverages').where('className', '==', currentBaseName).get()
            .then((snapshot) => {
                if (!snapshot.empty) {
                    classAveragesDocId = snapshot.docs[0].id;
                    return db.collection('classAverages').doc(classAveragesDocId).set(dataToSave, { merge: false });
                } else {
                    return db.collection('classAverages').add(dataToSave).then((ref) => {
                        classAveragesDocId = ref.id;
                    });
                }
            })
            .then(() => showMessage('Opgeslagen!', 'success'))
            .catch((error) => showMessage('Fout bij opslaan: ' + error.message, 'error'));
    }
}
