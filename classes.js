// === KLASSENOVERZICHT ===

// Auth-check (indien je die in je huidige app.js had)
// Als je geen auth gebruikt, kun je deze regel negeren of verwijderen.
// auth.onAuthStateChanged((user) => { ... });

// Laad alle klassen
function loadClasses() {
    db.collection("classes").orderBy("createdAt", "desc").get()
        .then((querySnapshot) => {
            const container = document.getElementById('classesList');
            container.innerHTML = '';

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const safeName = data.name.replace(/'/g, "\\'");

                const classElement = `
                    <div class="class-card" onclick="window.location.href='students.html?classId=${doc.id}&className=${encodeURIComponent(data.name)}'">
                        <h3>${data.name}</h3>
                        <p>${data.studentCount || 0} leerlingen</p>
                        <p>Aangemaakt: ${new Date(data.createdAt?.toDate()).toLocaleDateString()}</p>
                        <button class="delete-btn" onclick="deleteClass('${doc.id}', event)">Verwijder klas</button>
                        <button class="duplicate-btn" onclick="duplicateClass('${doc.id}', event)">Dupliceer klas</button>
                        <button class="edit-btn" onclick="showEditClassForm('${doc.id}', '${safeName}', event)">Wijzig naam</button>
                        <button class="contestants-btn" onclick="event.stopPropagation(); window.location.href='contestants.html?classId=${doc.id}'">Deelnemers</button>
                        <button class="averages-btn" onclick="event.stopPropagation(); window.location.href='averages.html?className=${encodeURIComponent(data.name)}'">Toon gemiddelden</button>
                    </div>
                `;
                container.innerHTML += classElement;
            });
        })
        .catch((error) => {
            console.error("Fout bij laden klassen: ", error);
        });
}

// Nieuwe klas toevoegen
function showAddClassForm() {
    document.getElementById('addClassForm').style.display = 'block';
}

function hideAddClassForm() {
    document.getElementById('addClassForm').style.display = 'none';
}

function addClass() {
    const className = document.getElementById('className').value.trim();

    if (!className) {
        alert("Voer een klassenaam in");
        return;
    }

    const classData = {
        name: className,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        studentCount: 0
    };

    db.collection("classes").add(classData)
        .then(() => {
            console.log("Klas toegevoegd");
            document.getElementById('className').value = '';
            hideAddClassForm();
            loadClasses();
        })
        .catch((error) => {
            console.error("Fout bij toevoegen klas: ", error);
            alert("Fout bij toevoegen klas: " + error.message);
        });
}

// Verwijderen van een klas (met alle leerlingen)
function deleteClass(classId, event) {
    if (event) event.stopPropagation();

    if (confirm("Weet je zeker dat je deze klas wilt verwijderen? Alle leerlingen worden ook verwijderd!")) {
        db.collection("students")
            .where("classId", "==", classId)
            .get()
            .then((querySnapshot) => {
                const batch = db.batch();
                querySnapshot.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                return batch.commit();
            })
            .then(() => {
                return db.collection("classes").doc(classId).delete();
            })
            .then(() => {
                console.log("Klas en leerlingen verwijderd");
                loadClasses();
            })
            .catch((error) => {
                console.error("Fout bij verwijderen: ", error);
                alert("Fout bij verwijderen: " + error.message);
            });
    }
}

// Dupliceer een klas (inclusief leerlingen)
function duplicateClass(classId, event) {
    if (event) event.stopPropagation();

    if (!confirm("Maak een kopie van deze klas? Leerlingen worden gekopieerd met scores op 0.")) {
        return;
    }

    db.collection("classes").doc(classId).get()
        .then((classDoc) => {
            if (!classDoc.exists) {
                throw new Error("Klas niet gevonden");
            }

            const originalClass = classDoc.data();
            const newClassName = originalClass.name + " (kopie)";

            const newClassData = {
                name: newClassName,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                studentCount: 0
            };

            return db.collection("classes").add(newClassData).then((newClassRef) => {
                return db.collection("students")
                    .where("classId", "==", classId)
                    .get()
                    .then((studentsSnapshot) => {
                        const batch = db.batch();

                        studentsSnapshot.forEach((studentDoc) => {
                            const originalStudent = studentDoc.data();
                            const newStudentData = {
                                firstName: originalStudent.firstName,
                                lastName: originalStudent.lastName,
                                classId: newClassRef.id,
                                currentScore: 0,
                                totalPoints: 0,
                                greenCards: 0,
                                purpleCards: 0,
                                yellowCards: 0,
                                redCards: 0,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp()
                            };
                            const newStudentRef = db.collection("students").doc();
                            batch.set(newStudentRef, newStudentData);
                        });

                        batch.update(newClassRef, { studentCount: studentsSnapshot.size });

                        return batch.commit();
                    });
            });
        })
        .then(() => {
            console.log("Klas gedupliceerd");
            alert("Klas is gekopieerd!");
            loadClasses();
        })
        .catch((error) => {
            console.error("Fout bij dupliceren: ", error);
            alert("Fout bij dupliceren: " + error.message);
        });
}

// Klasnaam bewerken
function showEditClassForm(classId, currentName, event) {
    if (event) event.stopPropagation();
    document.getElementById('editClassForm').style.display = 'block';
    document.getElementById('editClassName').value = currentName;
    document.getElementById('editClassId').value = classId;
}

function hideEditClassForm() {
    document.getElementById('editClassForm').style.display = 'none';
    document.getElementById('editClassName').value = '';
    document.getElementById('editClassId').value = '';
}

function updateClassName() {
    const classId = document.getElementById('editClassId').value;
    const newName = document.getElementById('editClassName').value.trim();

    if (!newName) {
        alert("Voer een klasnaam in");
        return;
    }

    db.collection("classes").doc(classId).update({
        name: newName
    })
    .then(() => {
        console.log("Klasnaam bijgewerkt");
        hideEditClassForm();
        loadClasses();
    })
    .catch(error => {
        console.error("Fout bij updaten klasnaam: ", error);
        alert("Fout: " + error.message);
    });
}

// Initialisatie
document.addEventListener('DOMContentLoaded', () => {
    loadClasses();

    document.addEventListener('click', (e) => {
        const addClassForm = document.getElementById('addClassForm');
        if (addClassForm.style.display === 'block' && !addClassForm.contains(e.target) &&
            !e.target.matches('[onclick*="showAddClassForm"]')) {
            hideAddClassForm();
        }
    });
});
