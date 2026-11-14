// === STUDENT EXTRA INFO ===

let currentStudentId = null;
let currentClassId = null;
let currentClassName = null;

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    currentStudentId = params.get('studentId');
    currentClassId = params.get('classId') || '';
    currentClassName = params.get('className') || '';

    if (!currentStudentId) {
        alert("Geen leerling gevonden. Ga terug naar het leerlingenoverzicht.");
        window.location.href = 'classes.html';
        return;
    }

    // Terugknop: stel de juiste URL in
    const backBtn = document.getElementById('backBtn');
    backBtn.onclick = () => {
        if (currentClassId && currentClassName) {
            window.location.href = 'students.html?classId=' + encodeURIComponent(currentClassId) +
                '&className=' + encodeURIComponent(currentClassName);
        } else {
            window.location.href = 'classes.html';
        }
    };

    // Laad de naam van de leerling en de bestaande info
    loadStudentName();
    loadStudentInfo();
});

// Haal de naam van de leerling op (voor de titel)
function loadStudentName() {
    db.collection('students').doc(currentStudentId).get()
        .then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                document.getElementById('pageTitle').textContent =
                    'Extra info: ' + data.firstName + ' ' + data.lastName;
            } else {
                document.getElementById('pageTitle').textContent = 'Extra info (leerling niet gevonden)';
            }
        })
        .catch((error) => {
            console.error('Fout bij laden leerling:', error);
        });
}

// Laad bestaande studentInfo (notities + foto-URL)
function loadStudentInfo() {
    db.collection('studentInfo').doc(currentStudentId).get()
        .then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                document.getElementById('notesField').value = data.notes || '';
                document.getElementById('photoUrlField').value = data.photoUrl || '';
            }
            // Als het niet bestaat: velden blijven leeg
        })
        .catch((error) => {
            console.error('Fout bij laden studentInfo:', error);
            showMessage('Fout bij laden bestaande gegevens: ' + error.message, 'error');
        });
}

// Opslaan
function saveStudentInfo() {
    const notes = document.getElementById('notesField').value;
    const photoUrl = document.getElementById('photoUrlField').value.trim();

    const dataToSave = {
        studentId: currentStudentId,
        notes: notes,
        photoUrl: photoUrl,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('studentInfo').doc(currentStudentId).set(dataToSave, { merge: true })
        .then(() => {
            showMessage('Opgeslagen!', 'success');
        })
        .catch((error) => {
            console.error('Fout bij opslaan:', error);
            showMessage('Fout bij opslaan: ' + error.message, 'error');
        });
}

// Open de foto-URL in een nieuw tabblad
function openPhoto() {
    const url = document.getElementById('photoUrlField').value.trim();
    if (!url) {
        showMessage('Er is nog geen foto-URL ingevuld.', 'error');
        return;
    }
    window.open(url, '_blank');
}

// Statusmelding
function showMessage(text, type) {
    const el = document.getElementById('statusMessage');
    el.textContent = text;
    el.className = 'status-message ' + type;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}
