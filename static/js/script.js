document.addEventListener('DOMContentLoaded', function() {
    let score = 0;
    let remainingAttempts = 3;
    let isQuizFinished = false;
    let errorCount = 0;
    let currentGameIndex = 0;
    let currentGameName = "";
    let full_games_list = []; // Initialisez la liste des jeux comme vide
    let gameId = null; // ID de la partie en cours
    function loadGame() {
        // Charge le jeu actuel depuis le serveur
        fetch('/get-game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ gameId: gameId })
        })
            .then(response => response.json())
            .then(data => {
                if (data.name === "Finished") {
                    alert("Bravo, tous les jeux ont été trouvés !");
                    document.getElementById('game-image').src = '';
                    document.getElementById('return-home-button').style.display = 'block';
                    document.getElementById('game-image-container').style.justifyContent = 'center';
                    isQuizFinished = true;
                } else {
                    document.getElementById('game-image').src = `/static/${data.image}`;
                    document.getElementById('game-image-container').style.justifyContent = 'flex-start';
                    document.getElementById('game-name-input').value = '';
                    document.getElementById('feedback').innerText = '';
                    remainingAttempts = 3;
                    errorCount = 0;
                    currentGameName = data.name;
                    updateScoreDisplay();
                }
            });
    }

    // Chargez la liste des jeux depuis le serveur
    function loadGamesList() {
        fetch('/get-games-list')
            .then(response => response.json())
            .then(data => {
                full_games_list = data;
            });
    }

    document.getElementById('start-button').addEventListener('click', function() {
        // Récupère le nombre de jeux à deviner
        const gameCount = document.getElementById('game-count').value;

        // Chargez la liste des jeux
        loadGamesList();

        // Démarre le jeu
        document.getElementById('home-page').style.display = 'none';
        document.getElementById('game-page').style.display = 'flex';
        document.getElementById('return-home-button').style.display = 'none';
        isQuizFinished = false;
        errorCount = 0;
        score = 0;
        currentGameIndex = 0;

        // Envoie le nombre de jeux à deviner au serveur
        fetch('/creat_game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ count: gameCount })
        }).then(response => response.json())
        .then(data => {
            if (data.success) {
                gameId = data.game_id; // Stocke l'ID de la partie en cours
                loadGame();
            } else {
                alert("Erreur lors de la création du jeu. Veuillez réessayer.");
            }
        });
    });

    document.getElementById('submit-button').addEventListener('click', checkGameName);
    document.getElementById('game-name-input').addEventListener('keypress', function(event) {
        // Soumet la réponse lorsque l'utilisateur appuie sur Entrée
        if (event.key === 'Enter') {
            checkGameName();
        }
    });

    document.getElementById('return-home-button').addEventListener('click', function() {
        // Réinitialise le jeu et retourne à la page d'accueil
        fetch('/reset-game', { method: 'POST' }).then(() => {
            document.getElementById('game-page').style.display = 'none';
            document.getElementById('home-page').style.display = 'flex';
            isQuizFinished = false;
            errorCount = 0;
            score = 0;
            currentGameIndex = 0;
            loadGame();
        });
    });

    document.getElementById('skip-button').addEventListener('click', function() {
        // Passe le jeu actuel
        if (!isQuizFinished) {
            if (score >= 50) {
                score -= 50;
            }else{
                score = 0
            }
            updateScoreDisplay();
            document.getElementById('feedback').innerText = 'Plus d\'essais ! La réponse était ' + currentGameName + '.';
            setTimeout(function() {
                fetch('/skip-game', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: gameId }) })
                    .then(response => response.json())
                    .then(nextGameData => {
                        if (nextGameData.name === "Finished") {
                            alert("Bravo, tous les jeux ont été trouvés !");
                            document.getElementById('game-image').src = '';
                            document.getElementById('return-home-button').style.display = 'block';
                            document.getElementById('game-image-container').style.justifyContent = 'center';
                            isQuizFinished = true;
                        } else {
                            document.getElementById('game-image').src = `/static/${nextGameData.image}`;
                            document.getElementById('game-name-input').value = '';
                            document.getElementById('feedback').innerText = '';
                            remainingAttempts = 3;
                            errorCount = 0;
                            currentGameName = nextGameData.name;
                            updateScoreDisplay();
                        }
                    });
            }, 2000);
        }
    });


    function updateScoreDisplay() {
    // Met à jour l'affichage du score et des essais restants
        document.getElementById('score').innerText = score;
        document.getElementById('remaining-attempts').innerText = remainingAttempts;
    }

    function checkGameName() {
        // Vérifie si la réponse de l'utilisateur est correcte
        if (isQuizFinished) {
            return;
        }

        const userAnswer = document.getElementById('game-name-input').value.trim();
        const feedbackElement = document.getElementById('feedback');

        if (remainingAttempts > 0) {
            fetch('/check-answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ answer: userAnswer, gameId })
            })
            .then(response => response.json())
            .then(data => {
                if (data.is_correct) {
                    feedbackElement.innerText = "Correct !";
                    score += 100;
                    updateScoreDisplay();
                    document.getElementById('game-image').classList.add('correct-answer');
                    setTimeout(function() {
                        document.getElementById('game-image').classList.remove('correct-answer');
                        fetch('/next-game', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId }) })
                            .then(response => response.json())
                            .then(nextGameData => {
                                if (nextGameData.name === "Finished") {
                                    alert("Bravo, tous les jeux ont été trouvés !");
                                    document.getElementById('game-image').src = '';
                                    document.getElementById('return-home-button').style.display = 'block';
                                    document.getElementById('game-image-container').style.justifyContent = 'center';
                                    document.getElementById('game-image').src = '/static/'+nextGameData.image;
                                    isQuizFinished = true;
                                } else {
                                    document.getElementById('game-image').src = `/static/${nextGameData.image}`;
                                    document.getElementById('game-name-input').value = '';
                                    feedbackElement.innerText = '';
                                    remainingAttempts = 3;
                                    errorCount = 0;
                                    currentGameName = nextGameData.name;
                                    updateScoreDisplay();
                                }
                            });
                    }, 1000);
                } else {
                    feedbackElement.innerText = "Faux, essayez encore !";
                    errorCount += 1;
                    if (errorCount === 3) {
                        score -= 50;
                        errorCount = 0;
                        remainingAttempts = 0;
                        feedbackElement.innerText = 'Plus d\'essais ! La réponse était ' + currentGameName + '.';
                        setTimeout(function() {
                            fetch('/next-game', { method: 'POST' })
                                .then(response => response.json())
                                .then(nextGameData => {
                                    if (nextGameData.name === "Finished") {
                                        alert("Bravo, tous les jeux ont été trouvés !");
                                        document.getElementById('game-image').src = '';
                                        document.getElementById('return-home-button').style.display = 'block';
                                        document.getElementById('game-image-container').style.justifyContent = 'center';
                                        isQuizFinished = true;
                                    } else {
                                        document.getElementById('game-image').src = `/static/${nextGameData.image}`;
                                        document.getElementById('game-name-input').value = '';
                                        feedbackElement.innerText = '';
                                        remainingAttempts = 3;
                                        errorCount = 0;
                                        currentGameName = nextGameData.name;
                                        updateScoreDisplay();
                                    }
                                });
                        }, 2000);
                    } else {
                        remainingAttempts -= 1;
                        updateScoreDisplay();
                        document.getElementById('game-image').classList.add('wrong-answer');
                        setTimeout(function() {
                            document.getElementById('game-image').classList.remove('wrong-answer');
                        }, 1000);
                        document.getElementById('game-name-input').value = '';
                        setTimeout(function() {
                            feedbackElement.innerText = '';
                        }, 1500);
                    }
                }
            });
        } else {
            feedbackElement.innerText = 'Plus d\'essais ! La réponse était "' + currentGameName + '".';
            document.getElementById('game-image').classList.add('wrong-answer');
            setTimeout(function() {
                document.getElementById('game-image').classList.remove('wrong-answer');
                fetch('/next-game', { method: 'POST' })
                    .then(response => response.json())
                    .then(nextGameData => {
                        if (nextGameData.name === "Finished") {
                            alert("Bravo, tous les jeux ont été trouvés !");
                            document.getElementById('game-image').src = '';
                            document.getElementById('return-home-button').style.display = 'block';
                            document.getElementById('game-image-container').style.justifyContent = 'center';
                            isQuizFinished = true;
                        } else {
                            document.getElementById('game-image').src = `/static/${nextGameData.image}`;
                            document.getElementById('game-name-input').value = '';
                            feedbackElement.innerText = '';
                            remainingAttempts = 3;
                            errorCount = 0;
                            currentGameName = nextGameData.name;
                            updateScoreDisplay();
                        }
                    });
            }, 2000);
        }
    }

    // Ajoutez un écouteur d'événement pour détecter les modifications dans le champ de saisie
    document.getElementById('game-name-input').addEventListener('input', function() {
        const input = this.value.toLowerCase();
        const suggestionsContainer = document.getElementById('suggestions-container');
        suggestionsContainer.innerHTML = '';

        if (input.length > 0) {
            const filteredGames = full_games_list.filter(game =>
                game.name.toLowerCase().includes(input) ||
                game.answers.some(answer => answer.toLowerCase().includes(input))
            );

            if (filteredGames.length > 0) {
                filteredGames.forEach(game => {
                    const suggestionItem = document.createElement('div');
                    suggestionItem.className = 'suggestion-item';
                    suggestionItem.textContent = game.name;
                    suggestionItem.addEventListener('click', function() {
                        document.getElementById('game-name-input').value = game.name;
                        suggestionsContainer.style.display = 'none';
                    });
                    suggestionsContainer.appendChild(suggestionItem);
                });
                suggestionsContainer.style.display = 'block';
            } else {
                suggestionsContainer.style.display = 'none';
            }
        } else {
            suggestionsContainer.style.display = 'none';
        }
    });

    // Fermez le conteneur de suggestions si l'utilisateur clique ailleurs
    document.addEventListener('click', function(event) {
        const suggestionsContainer = document.getElementById('suggestions-container');
        if (!event.target.closest('#game-name-input') && !event.target.closest('#suggestions-container')) {
            suggestionsContainer.style.display = 'none';
        }
    });
});

const table = {
    cat : [
        "chat", "félin", "animal de compagnie", "miaou", "ronronnement", "queue", "poils", "griffe", "jouet pour chat", "boîte"
    ]
    , dog : [
        "chien", "canin", "animal de compagnie", "aboiement", "queue", "poils", "jouet pour chien", "os", "collier", "friandise"
    ]
    , bird : [
        "oiseau", "volant", "plumes", "chant", "nid", "bec", "ailes", "perchoir", "cage", "graines"
    ]
}

console.table(table);
console.log(table)