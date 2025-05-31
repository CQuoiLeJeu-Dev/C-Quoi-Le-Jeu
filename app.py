from flask import Flask, jsonify, render_template, request, redirect, url_for, session, flash, g
import random
import sqlite3
import os
import logging
import bcrypt
import time



app = Flask(__name__)
app.secret_key = 'SECRET_KEY'

DATABASE = 'users.db'

# Configurez le logging
logging.basicConfig(level=logging.DEBUG)

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

def init_db():
    with app.app_context():
        db = get_db()
        with app.open_resource('schema.sql', mode='r') as f:
            db.cursor().executescript(f.read())
        db.commit()

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()


def query_db(query, args=(), one=False):
    cur = get_db().execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv

def save_user(username, password):
    # Hacher le mot de passe
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    db = get_db()
    db.execute('INSERT INTO users (username, password) VALUES (?, ?)', (username, hashed_password))
    db.commit()

def check_user(username, password):
    user = query_db('SELECT * FROM users WHERE username = ?', [username], one=True)
    if user:
        hashed_password = user['password']
        # Vérifiez si le mot de passe est déjà en bytes
        if isinstance(hashed_password, str):
            hashed_password = hashed_password.encode('utf-8')
        # Vérifier le mot de passe haché
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password)
    return False

def get_user_id_by_username(username):
    user = query_db('SELECT id FROM users WHERE username = ?', [username], one=True)
    return user['id'] if user else None

def save_game_result(user_id, game_name, score):
    db = get_db()
    db.execute('INSERT INTO games_history (user_id, game_name, score) VALUES (?, ?, ?)',
               (user_id, game_name, score))
    db.commit()

def get_user_games(user_id):
    db = get_db()
    return db.execute('SELECT game_name, score, played_at FROM games_history WHERE user_id = ?', (user_id,)).fetchall()

# Liste complète des jeux
if os.path.exists('games_list.json'):
    import json
    with open('games_list.json', 'r') as f:
        full_games_list = json.load(f)
else:
    # Si le fichier n'existe pas, initialisez une liste vide
    import json
    full_games_list = []
    print("Le fichier 'games_list.json' n'existe pas. Initialisation d'une liste vide.")

# Liste des jeux pour la session actuelle
games = {} # comment cette ligne de code peut permetre de stocker les jeux pour plusieur utilisateurs en meme temps


current_game_index = 0
score = 0  # Initialise la variable score ici

@app.route('/')
def index():
    if 'username' in session:
        return render_template('index.html', username=session['username'])
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        if check_user(username, password):
            session['username'] = username
              # Assurez-vous que st appelé ici
            return redirect(url_for('index'))
        flash("Nom d'utilisateur ou mot de passe incorrect.")
        return render_template('login.html')
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        if len(password) < 6:
            flash("Le mot de passe doit contenir au moins 6 caractères.")
            return render_template('register.html')

        if len(username) > 20:
            flash("Le nom d'utilisateur doit contenir au maximum 20 caractères.")
            return render_template('register.html')

        if len(password) > 20:
            flash("Le mot de passe doit contenir au maximum 20 caractères.")
            return render_template('register.html')

        try:
            # Vérifiez si l'utilisateur existe déjà
            user = query_db('SELECT * FROM users WHERE username = ?', [username], one=True)
            if user is not None:
                flash("Nom d'utilisateur déjà existant.")
                return render_template('register.html')

            # Si l'utilisateur n'existe pas, enregistrez-le
            save_user(username, password)
            session['username'] = username
            
            return redirect(url_for('index'))

        except Exception as e:
            # Log l'erreur pour le débogage
            app.logger.error(f"Erreur lors de l'inscription: {e}")
            flash("Une erreur est survenue lors de l'inscription. Veuillez réessayer.")
            return render_template('register.html')

    return render_template('register.html')

@app.route('/logout')
def logout():
    session.pop('username', None)
    flash("Vous avez été déconnecté.")
    return redirect(url_for('login'))

@app.route('/get-game', methods=['POST'])
def get_game(game_id=None):
    data = request.json
    print("Received data:", data)
    if "gameId" in data or game_id is not None:
        game_id = data['gameId'] or game_id
        user_id = get_user_id_by_username(session['username'])
        print(game_id)
        global games
        print(games)
        if game_id in games:
            current_game_index = games[game_id]["current_game_index"]
            score = games[game_id]["score"]
            print("Current game index before increment:", current_game_index, len(games), current_game_index >= len(games))
            if current_game_index >= len(games):
                save_game_result(user_id, games[game_id]["data"][current_game_index]["name"], score)
                games[game_id] = None  # Supprime le jeu de la mémoire
                print("Game finished, removing from memory.")
                return jsonify({"name": "Finished", "image": "/images/end.webp"})
            party = games[game_id]["data"][games[game_id]["current_game_index"]]# récupère l'index de la partie actuelle puis l'utilise pour obtenir le jeu actuel
            response_party = party.copy()
            response_party["answers"] = []  # Ou supprime la clé si tu préfères
            return jsonify(response_party)
        else:
            return jsonify({"error": "Game not found"}), 404
    else:
        return jsonify({"error": "Game ID not provided"}), 400

@app.route('/next-game', methods=['POST'])
def next_game():
    data = request.json
    if "gameId" in data:
        game_id = data['gameId']
        if game_id not in games:
            return jsonify({"error": "Game not found"}), 404
        else:
            global current_game_index, score
            print("Current game index:", current_game_index)
            print("Score before saving:", score)
            user_id = games[game_id]["user_id"]
            # game = games
            print("Game data:", games[game_id]["data"])
            print("Saving game result for user ID:", user_id)
            print("Score after saving:", score)
            games[game_id]["current_game_index"] += 1
            return get_game(game_id)
    else:
        return jsonify({"error": "Game ID not provided"}), 400

@app.route('/skip-game', methods=['POST'])
def skip_game():
    data = request.json
    if "gameId" in data:
        game_id = data['gameId']
        if game_id not in games:
            return jsonify({"error": "Game not found"}), 404
        else:
            current_game_index = games[game_id]["current_game_index"]
            score = games[game_id]["score"]
            games[game_id]["current_game_index"] += 1
            if score >= 50: # reduire le score de 50 sans passer en dessous de 0
                score -= 50
            else:
                score = 0
            return get_game()
    else:
        return jsonify({"error": "Game ID not provided"}), 400

@app.route('/check-answer', methods=['POST'])
def check_answer():
    data = request.json
    if "gameId" in data:
        game_id = data['gameId']
        if game_id not in games:
            return jsonify({"error": "Game not found"}), 404
        else:
            data = request.json
            user_answer = data.get('answer', '').strip().lower()
            print("=== DEBUG ===")
            print("Game ID:", game_id)
            print("Current Index:", games[game_id]["current_game_index"])
            print("Game Data:", games[game_id]["data"])
            party = games[game_id]["data"][games[game_id]["current_game_index"]]
            print("User answer:", user_answer ,"Party answers:", party["answers"])
            is_correct = user_answer in [answer.lower() for answer in party["answers"]]
            if is_correct:
                games[game_id]["score"] += 100
            return jsonify({"is_correct": is_correct})
    else:
        return jsonify({"error": "Game ID not provided"}), 400

@app.route('/creat_game', methods=['POST'])
def creat_game():
    global games
    GAME_ID = random.randint(1000000, 9999999)

    data = request.json
    count = int(data.get('count', 10))
    games[GAME_ID] = {
        "username": session['username'],
        "user_id": get_user_id_by_username(session['username']),
        "data": random.sample(full_games_list, min(count, len(full_games_list))),
        "score": 0,
        "current_game_index": 0,
        "endTime": "TODO: mettre une date de fin pour éviter d'avoir des parties en cours pendant des mois et qui occupent de la mémoire"
    }
    
    return jsonify({"game_id": GAME_ID, "success": True})


@app.route('/settings', methods=['GET', 'POST'])
def settings():
    if 'username' not in session:
        return redirect(url_for('login'))
    if request.method == 'POST':
        new_password = request.form['new_password']
        if len(new_password) < 6:
            flash("Le mot de passe doit contenir au moins 6 caractères.")
            return render_template('settings.html')
        # Hacher le nouveau mot de passe
        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        db = get_db()
        db.execute('UPDATE users SET password = ? WHERE username = ?', (hashed_password, session['username']))
        db.commit()
        flash("Mot de passe mis à jour avec succès.")
    return render_template('settings.html')

@app.route('/delete_account', methods=['POST'])
def delete_account():
    if 'username' not in session:
        return redirect(url_for('login'))

    username = session['username']
    password = request.form['password']

    if not check_user(username, password):
        flash("Mot de passe incorrect.")
        return redirect(url_for('settings'))

    db = get_db()
    user_id = get_user_id_by_username(username)
    db.execute('DELETE FROM games_history WHERE user_id = ?', (user_id,))
    db.execute('DELETE FROM users WHERE username = ?', (username,))
    db.commit()
    session.pop('username', None)
    flash("Votre compte a été supprimé avec succès.")
    return redirect(url_for('login'))

@app.route('/my_games')
def my_games():
    if 'username' not in session:
        return redirect(url_for('login'))
    user_id = get_user_id_by_username(session['username'])
    games = get_user_games(user_id)
    return render_template('my_games.html', games=games)

@app.route('/get-games-list', methods=['GET'])
def get_games_list():
    return jsonify(full_games_list)

@app.route('/contact')
def contact():
    return render_template('contact.html')


if __name__ == '__main__':
    with app.app_context():
        init_db()
    app.run(debug=True)