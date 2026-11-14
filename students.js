// === LEERLINGENPAGINA ===

// URL-parameters
let currentClassId = null;
let currentClassName = null;

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    currentClassId = params.get('classId');
    currentClassName = params.get('className') || '';

    if (!currentClassId) {
        alert("Geen klas gevonden. Ga terug naar het klassenoverzicht.");
        window.location.href = 'classes.html';
        return;
    }

    document.getElementById('classNameTitle').textContent = currentClassName || 'Klas';
    document.getElementById('currentClassId').value = currentClassId;

    loadStudents(currentClassId, currentClassName);

    document.addEventListener('click', (e) => {
        const addStudentForm = document.getElementById('addStudentForm');
        if (addStudentForm.style.display === 'block' && !addStudentForm.contains(e.target) &&
            !e.target.matches('[onclick*="showAddStudentForm"]')) {
            hideAddStudentForm();
        }
    });
});

// Laad leerlingen van de klas
function loadStudents(classId, className) {
    currentClassId = classId;
    currentClassName = className;

    db.collection("students")
        .where("classId", "==", classId)
        .orderBy("lastName")
        .get()
        .then((querySnapshot) => {
            const container = document.getElementById('studentsGrid');
            container.innerHTML = '';

            querySnapshot.forEach((doc) => {
                const student = doc.data();
                container.innerHTML += createStudentCard(doc.id, student);
            });
        })
        .catch((error) => {
            console.error("Fout bij laden leerlingen: ", error);
        });
}

// Maak studentkaart
function createStudentCard(studentId, student) {
    const score = student.currentScore || 0;

    let cardsHTML = '';
    if (score <= -10) cardsHTML += '<span class="card-indicator card-red">RODE KAART</span>';
    if (score <= -5) cardsHTML += '<span class="card-indicator card-yellow">GELE KAART</span>';
    if (score >= 5) cardsHTML += '<span class="card-indicator card-green">GROENE KAART</span>';
    if (score >= 10) cardsHTML += '<span class="card-indicator card-purple">PAARSE KAART</span>';

    // Bouw 21 knopjes van -10 t/m 10
    let buttonsHTML = '';
    for (let i = -10; i <= 10; i++) {
        // Bepaal de kleur op basis van de waarde
        const color = scoreButtonColor(i);
        const activeClass = (i === score) ? ' active' : '';
        const label = (i > 0) ? '+' + i : i.toString();
        buttonsHTML += `
            <button
                class="score-pill${activeClass}"
                style="background: ${color};"
                onclick="setScore('${studentId}', ${i})"
                title="Zet score op ${i}"
            >${label}</button>
        `;
    }

    return `
        <div class="student-card" id="student-${studentId}">
            <div class="student-info">
                <div class="student-name">${student.firstName} ${student.lastName}</div>
                <div class="student-score">${score > 0 ? '+' : ''}${score}</div>
            </div>

            <div class="score-pills">
                ${buttonsHTML}
            </div>

            <div class="card-indicators">
                ${cardsHTML}
            </div>

            <div class="student-buttons">
                <button class="delete-btn" onclick="deleteStudent('${studentId}')">Verwijder leerling</button>
                <button class="edit-btn" onclick="showEditStudentForm('${studentId}', '${student.firstName.replace(/'/g, "\\'")}', '${student.lastName.replace(/'/g, "\\'")}')">Wijzig naam</button>
            </div>
        </div>
    `;
}

// Hulpfunctie: kleur van rood (-10) naar groen (+10)
function scoreButtonColor(value) {
    // -10 = rood (#ff4444), 0 = geel (#ffbb33), +10 = groen (#00C851)
    // We interpoleren tussen rood → geel → groen
    if (value <= 0) {
        // -10..0 : rood naar geel
        const t = (value + 10) / 10; // 0 bij -10, 1 bij 0
        const r = Math.round(255);
        const g = Math.round(68 + (187 - 68) * t);  // 68 → 187
        const b = Math.round(68 + (51 - 68) * t);   // 68 → 51
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        // 0..10 : geel naar groen
        const t = value / 10; // 0 bij 0, 1 bij 10
        const r = Math.round(255 - (255 - 0) * t);  // 255 → 0
        const g = Math.round(187 + (200 - 187) * t); // 187 → 200
        const b = Math.round(51 + (81 - 51) * t);   // 51 → 81
        return `rgb(${r}, ${g}, ${b})`;
    }
}

// Zet de score direct op een bepaalde waarde
function setScore(studentId, newScore) {
    // Beperk tot -10..10 (zou al zo moeten zijn, maar voor de zekerheid)
    newScore = Math.max(-10, Math.min(10, newScore));

    const studentRef = db.collection("students").doc(studentId);

    db.runTransaction((transaction) => {
        return transaction.get(studentRef).then((doc) => {
            if (!doc.exists) {
                throw new Error("Leerling niet gevonden");
            }

            const student = doc.data();
            const oldScore = student.currentScore || 0;

            // Als de score niet verandert: niets doen
            if (oldScore === newScore) {
                return null;
            }

            transaction.update(studentRef, {
                currentScore: newScore,
                totalPoints: (student.totalPoints || 0) + Math.abs(newScore - oldScore)
            });

            const eventData = {
                studentId: studentId,
                classId: student.classId,
                change: newScore - oldScore,
                newScore: newScore,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (newScore === 5) eventData.cardAwarded = "green";
            if (newScore === 10) eventData.cardAwarded = "purple";
            if (newScore === -5) eventData.cardAwarded = "yellow";
            if (newScore === -10) eventData.cardAwarded = "red";

            return db.collection("behaviorEvents").add(eventData);
        });
    })
    .then(() => {
        // Herlaad de studentkaart
        studentRef.get().then((doc) => {
            if (doc.exists) {
                const studentCard = document.getElementById(`student-${studentId}`);
                if (studentCard) {
                    studentCard.outerHTML = createStudentCard(studentId, doc.data());
                }
            }
        });
    })
    .catch((error) => {
        console.error("Fout bij zetten score: ", error);
        alert("Fout bij bijwerken score: " + error.message);
    });
}

// Nieuwe leerling toevoegen
function showAddStudentForm() {
    document.getElementById('addStudentForm').style.display = 'block';
    document.getElementById('currentClassId').value = currentClassId;
}

function hideAddStudentForm() {
    document.getElementById('addStudentForm').style.display = 'none';
}

function addStudent() {
    const firstName = document.getElementById('studentFirstName').value.trim();
    const lastName = document.getElementById('studentLastName').value.trim();
    const classId = document.getElementById('currentClassId').value;

    if (!firstName || !lastName) {
        alert("Voer naam in");
        return;
    }

    const studentData = {
        firstName: firstName,
        lastName: lastName,
        classId: classId,
        currentScore: 0,
        totalPoints: 0,
        greenCards: 0,
        purpleCards: 0,
        yellowCards: 0,
        redCards: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("students").add(studentData)
        .then(() => {
            console.log("Leerling toegevoegd");
            document.getElementById('studentFirstName').value = '';
            document.getElementById('studentLastName').value = '';
            hideAddStudentForm();
            loadStudents(currentClassId, currentClassName);
        })
        .catch((error) => {
            console.error("Fout bij toevoegen leerling: ", error);
            alert("Fout bij toevoegen leerling: " + error.message);
        });
}

// Leerling verwijderen
function deleteStudent(studentId) {
    if (confirm("Weet je zeker dat je deze leerling wilt verwijderen?")) {
        db.collection("students").doc(studentId).delete()
            .then(() => {
                console.log("Leerling verwijderd");
                document.getElementById(`student-${studentId}`).remove();
            })
            .catch((error) => {
                console.error("Fout bij verwijderen leerling: ", error);
                alert("Fout bij verwijderen leerling: " + error.message);
            });
    }
}

// Leerlingnaam bewerken
function showEditStudentForm(studentId, firstName, lastName) {
    document.getElementById('editStudentForm').style.display = 'block';
    document.getElementById('editStudentFirstName').value = firstName;
    document.getElementById('editStudentLastName').value = lastName;
    document.getElementById('editStudentId').value = studentId;
}

function hideEditStudentForm() {
    document.getElementById('editStudentForm').style.display = 'none';
    document.getElementById('editStudentFirstName').value = '';
    document.getElementById('editStudentLastName').value = '';
    document.getElementById('editStudentId').value = '';
}

function updateStudentName() {
    const studentId = document.getElementById('editStudentId').value;
    const newFirstName = document.getElementById('editStudentFirstName').value.trim();
    const newLastName = document.getElementById('editStudentLastName').value.trim();

    if (!newFirstName || !newLastName) {
        alert("Voer voor- en achternaam in");
        return;
    }

    db.collection("students").doc(studentId).update({
        firstName: newFirstName,
        lastName: newLastName
    })
    .then(() => {
        console.log("Leerlingnaam bijgewerkt");
        hideEditStudentForm();
        if (currentClassId) {
            loadStudents(currentClassId, currentClassName);
        }
    })
    .catch(error => {
        console.error("Fout bij updaten leerlingnaam: ", error);
        alert("Fout: " + error.message);
    });
}
