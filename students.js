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
    const leftPosition = ((score + 10) / 20) * 100;

    let cardsHTML = '';
    if (score <= -10) cardsHTML += '<span class="card-indicator card-red">RODE KAART</span>';
    if (score <= -5) cardsHTML += '<span class="card-indicator card-yellow">GELE KAART</span>';
    if (score >= 5) cardsHTML += '<span class="card-indicator card-green">GROENE KAART</span>';
    if (score >= 10) cardsHTML += '<span class="card-indicator card-purple">PAARSE KAART</span>';

    return `
        <div class="student-card" id="student-${studentId}">
            <div class="student-info">
                <div class="student-name">${student.firstName} ${student.lastName}</div>
                <div class="student-score">${score > 0 ? '+' : ''}${score}</div>
            </div>

            <div class="score-container">
                <button class="score-btn score-minus" onclick="updateScore('${studentId}', -1)">-</button>

                <div class="score-bar">
                    <div class="score-indicator"></div>
                    <div class="score-dot" style="left: ${leftPosition}%;"></div>
                </div>

                <button class="score-btn score-plus" onclick="updateScore('${studentId}', 1)">+</button>
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

// Score aanpassen
function updateScore(studentId, change) {
    const studentRef = db.collection("students").doc(studentId);

    db.runTransaction((transaction) => {
        return transaction.get(studentRef).then((doc) => {
            if (!doc.exists) {
                throw new Error("Leerling niet gevonden");
            }

            const student = doc.data();
            const currentScore = student.currentScore || 0;
            const newScore = Math.max(-10, Math.min(10, currentScore + change));

            transaction.update(studentRef, {
                currentScore: newScore,
                totalPoints: (student.totalPoints || 0) + Math.abs(change)
            });

            const eventData = {
                studentId: studentId,
                classId: student.classId,
                change: change,
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
        console.log("Score bijgewerkt");
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
        console.error("Fout bij updaten score: ", error);
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