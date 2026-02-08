let currentClassId = null;

// Laad alle klassen
function loadClasses() {
    db.collection("classes").orderBy("createdAt", "desc").get()
        .then((querySnapshot) => {
            const container = document.getElementById('classesList');
            container.innerHTML = '';
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const classElement = `
                    <div class="class-card" onclick="loadStudents('${doc.id}', '${data.name}')">
                        <h3>${data.name}</h3>
                        <p>${data.studentCount || 0} leerlingen</p>
                        <p>Aangemaakt: ${new Date(data.createdAt?.toDate()).toLocaleDateString()}</p>
                        <button class="delete-btn" onclick="deleteClass('${doc.id}', event)">Verwijder klas</button>
                    </div>
                `;
                container.innerHTML += classElement;
            });
        })
        .catch((error) => {
            console.error("Fout bij laden klassen: ", error);
        });
}

// Laad leerlingen van een klas
function loadStudents(classId, className) {
    currentClassId = classId;
    
    document.getElementById('classesList').style.display = 'none';
    document.getElementById('studentsList').style.display = 'block';
    document.getElementById('classNameTitle').textContent = className;
    
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

// Maak student kaart
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
            
            <button class="delete-btn" onclick="deleteStudent('${studentId}')">Verwijder leerling</button>
        </div>
    `;
}

// Update score van leerling
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
            
            // Voeg event toe
            const eventData = {
                studentId: studentId,
                classId: student.classId,
                change: change,
                newScore: newScore,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Controleer voor kaarten
            if (newScore === 5) eventData.cardAwarded = "green";
            if (newScore === 10) eventData.cardAwarded = "purple";
            if (newScore === -5) eventData.cardAwarded = "yellow";
            if (newScore === -10) eventData.cardAwarded = "red";
            
            return db.collection("behaviorEvents").add(eventData);
        });
    })
    .then(() => {
        console.log("Score bijgewerkt");
        // Herlaad de student
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

// Nieuwe klas toevoegen
function showAddClassForm() {
    document.getElementById('addClassForm').style.display = 'block';
}

function hideAddClassForm() {
    document.getElementById('addClassForm').style.display = 'none';
}

function addClass() {
    const className = document.getElementById('className').value;
    
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

// Nieuwe leerling toevoegen
function showAddStudentForm() {
    document.getElementById('addStudentForm').style.display = 'block';
    document.getElementById('currentClassId').value = currentClassId;
}

function hideAddStudentForm() {
    document.getElementById('addStudentForm').style.display = 'none';
}

function addStudent() {
    const firstName = document.getElementById('studentFirstName').value;
    const lastName = document.getElementById('studentLastName').value;
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
            loadStudents(classId, document.getElementById('classNameTitle').textContent);
        })
        .catch((error) => {
            console.error("Fout bij toevoegen leerling: ", error);
            alert("Fout bij toevoegen leerling: " + error.message);
        });
}

// Verwijder functionaliteit
function deleteClass(classId, event) {
    event.stopPropagation();
    
    if (confirm("Weet je zeker dat je deze klas wilt verwijderen? Alle leerlingen worden ook verwijderd!")) {
        // Verwijder eerst alle leerlingen van deze klas
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
                // Verwijder de klas
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

// Terug naar klassen overzicht
function backToClasses() {
    document.getElementById('studentsList').style.display = 'none';
    document.getElementById('classesList').style.display = 'grid';
    currentClassId = null;
    loadClasses();
}

// Initialisatie
document.addEventListener('DOMContentLoaded', () => {
    loadClasses();
    
    // Sluit formulier als er buiten geklikt wordt
    document.addEventListener('click', (e) => {
        const addClassForm = document.getElementById('addClassForm');
        const addStudentForm = document.getElementById('addStudentForm');
        
        if (addClassForm.style.display === 'block' && !addClassForm.contains(e.target) && 
            !e.target.matches('[onclick*="showAddClassForm"]')) {
            hideAddClassForm();
        }
        
        if (addStudentForm.style.display === 'block' && !addStudentForm.contains(e.target) && 
            !e.target.matches('[onclick*="showAddStudentForm"]')) {
            hideAddStudentForm();
        }
    });
});
