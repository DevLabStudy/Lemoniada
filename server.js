const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./lemoniada.db');

// Tabela z obsługą statusu
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS zamowienia (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        produkt TEXT,
        godzina TEXT,
        status TEXT DEFAULT 'PRZYJĘTE'
    )`);
});

// Endpoint dla klienta
app.post('/zamow', (req, res) => {
    const { produkt } = req.body;
    const godzina = new Date().toLocaleTimeString('pl-PL');
    db.run(`INSERT INTO zamowienia (produkt, godzina) VALUES (?, ?)`, [produkt, godzina], function(err) {
        if (err) return res.status(500).send(err.message);
        res.json({ id: this.lastID });
    });
});

// Pobieranie wszystkich zamówień (dla admina i statusu klienta)
app.get('/list-zamowienia', (req, res) => {
    db.all(`SELECT * FROM zamowienia ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).send(err.message);
        res.json(rows);
    });
});

// Zmiana statusu przez Admina
app.post('/update-status', (req, res) => {
    const { id, nowyStatus } = req.body;
    db.run(`UPDATE zamowienia SET status = ? WHERE id = ?`, [nowyStatus, id], (err) => {
        if (err) return res.status(500).send(err.message);
        res.json({ success: true });
    });
});

app.listen(3000, () => console.log('Backend na Linuxie gotowy!'));