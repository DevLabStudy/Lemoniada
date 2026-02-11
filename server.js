const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();

app.use(cors()); // Pozwala stronie na GitHubie gadać z Twoim Linuxem
app.use(express.json());

// Baza danych w pliku na Linuxie
const db = new sqlite3.Database('./lemoniada.db');

db.run(`CREATE TABLE IF NOT EXISTS zamowienia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produkt TEXT,
    godzina TEXT,
    status TEXT DEFAULT 'NOWE'
)`);

app.post('/zamow', (req, res) => {
    const { produkt } = req.body;
    const godzina = new Date().toLocaleTimeString('pl-PL');
    db.run(`INSERT INTO zamowienia (produkt, godzina) VALUES (?, ?)`, [produkt, godzina], function(err) {
        if (err) return res.status(500).send(err.message);
        res.json({ id: this.lastID, msg: "Dodano!" });
    });
});

app.get('/list-zamowienia', (req, res) => {
    db.all(`SELECT * FROM zamowienia ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).send(err.message);
        res.json(rows);
    });
});

app.listen(3000, () => console.log('Serwer SQLite śmiga na porcie 3000'));