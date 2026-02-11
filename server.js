const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./lemoniada.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS zamowienia (
                                                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                      produkty TEXT,
                                                      suma TEXT,
                                                      platnosc TEXT,
                                                      godzina TEXT,
                                                      status TEXT DEFAULT 'PRZYJĘTE'
            )`);
});

app.post('/zamow', (req, res) => {
    const { produkty, suma, platnosc } = req.body;
    const godzina = new Date().toLocaleTimeString('pl-PL');
    db.run(`INSERT INTO zamowienia (produkty, suma, platnosc, godzina) VALUES (?, ?, ?, ?)`,
        [produkty, suma, platnosc, godzina], function(err) {
            if (err) return res.status(500).send(err.message);
            res.json({ id: this.lastID });
        });
});

app.get('/list-zamowienia', (req, res) => {
    db.all(`SELECT * FROM zamowienia ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).send(err.message);
        res.json(rows);
    });
});

app.post('/update-status', (req, res) => {
    const { id, nowyStatus } = req.body;
    db.run(`UPDATE zamowienia SET status = ? WHERE id = ?`, [nowyStatus, id], (err) => {
        if (err) res.status(500).send(err.message);
        else res.json({ success: true });
    });
});

app.listen(3000, () => console.log('System POS aktywny na porcie 3000'));