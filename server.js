const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();

// Pełna konfiguracja CORS dla domeny pl
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
        kod_rabatowy TEXT, 
        status TEXT DEFAULT 'PRZYJĘTE'
    )`);
});

let stanKubkow = 50; // Domyślny stan

app.get('/stan-magazynu', (req, res) => res.json({ kubki: stanKubkow }));

app.post('/ustaw-kubki', (req, res) => {
    stanKubkow = parseInt(req.body.ilosc, 10) || 0;
    res.json({ success: true, stan: stanKubkow });
});

app.post('/zamow', (req, res) => {
    const { produkty, suma, platnosc, kod } = req.body;
    const godzina = new Date().toLocaleTimeString('pl-PL');

    db.run('INSERT INTO zamowienia (produkty, suma, platnosc, godzina, kod_rabatowy) VALUES (?, ?, ?, ?, ?)',
        [produkty, suma, platnosc, godzina, kod], function(err) {
            if (err) return res.status(500).json({ error: "BŁĄD BAZY" });

            // Zmniejszamy stan przy zamówieniu
            const ilosc = produkty.split(', ').length;
            stanKubkow = Math.max(0, stanKubkow - ilosc);

            res.json({ id: this.lastID });
        });
});

app.get('/list-zamowienia', (req, res) => {
    db.all('SELECT * FROM zamowienia ORDER BY id DESC LIMIT 30', [], (err, rows) => res.json(rows || []));
});

app.post('/update-status', (req, res) => {
    db.run('UPDATE zamowienia SET status = ? WHERE id = ?', [req.body.nowyStatus, req.body.id], () => res.json({ success: true }));
});

const PORT = 8443;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Serwer LemonIada na porcie ${PORT}`));