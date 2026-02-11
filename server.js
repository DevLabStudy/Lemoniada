const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();

// BARDZO WAŻNE: To pozwala GitHubowi rozmawiać z Twoim PC
app.use(cors({ origin: '*' }));
app.use(express.json());

const db = new sqlite3.Database('./lemoniada.db');

// Tworzenie tabeli
db.run(`CREATE TABLE IF NOT EXISTS zamowienia (
                                                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                  produkty TEXT,
                                                  suma TEXT,
                                                  platnosc TEXT,
                                                  godzina TEXT,
                                                  status TEXT DEFAULT 'PRZYJĘTE'
        )`);

let stanKubkow = 0;
let statusDostawy = false;

// Pobieranie stanu magazynu
app.get('/stan-magazynu', (req, res) => {
    res.json({ kubki: stanKubkow, przerwa: statusDostawy });
});

// Ustawianie kubków
app.post('/ustaw-kubki', (req, res) => {
    stanKubkow = parseInt(req.body.ilosc) || 0;
    statusDostawy = false;
    res.json({ success: true, stan: stanKubkow });
});

// Przełączanie pauzy
app.post('/toggle-dostawa', (req, res) => {
    statusDostawy = !statusDostawy;
    res.json({ success: true, przerwa: statusDostawy });
});

// Nowe zamówienie od klienta
app.post('/zamow', (req, res) => {
    if (stanKubkow <= 0 || statusDostawy) {
        return res.status(400).json({ error: "Brak kubków lub przerwa" });
    }
    const { produkty, suma, platnosc } = req.body;
    const godzina = new Date().toLocaleTimeString('pl-PL');
    db.run(`INSERT INTO zamowienia (produkty, suma, platnosc, godzina) VALUES (?, ?, ?, ?)`,
        [produkty, suma, platnosc, godzina], function(err) {
            if (err) return res.status(500).json({error: err.message});
            stanKubkow--;
            res.json({ id: this.lastID });
        });
});

// Sprzedaż ręczna (stacjonarna)
app.post('/sprzedaz-reczna', (req, res) => {
    if (stanKubkow <= 0) return res.status(400).json({ error: "Brak kubków" });
    const { suma } = req.body;
    const godzina = new Date().toLocaleTimeString('pl-PL');
    db.run(`INSERT INTO zamowienia (produkty, suma, platnosc, godzina, status) VALUES (?, ?, ?, ?, ?)`,
        ['Stacjonarna', suma, 'Gotówka (Ręczna)', godzina, 'GOTOWE'], function(err) {
            stanKubkow--;
            res.json({ success: true });
        });
});

// Lista zamówień dla admina
app.get('/list-zamowienia', (req, res) => {
    db.all(`SELECT * FROM zamowienia ORDER BY id DESC`, [], (err, rows) => {
        res.json(rows || []);
    });
});

// Zmiana statusu
app.post('/update-status', (req, res) => {
    const { id, nowyStatus } = req.body;
    db.run(`UPDATE zamowienia SET status = ? WHERE id = ?`, [nowyStatus, id], () => {
        res.json({ success: true });
    });
});

app.listen(3000, '0.0.0.0', () => console.log('✅ SERWER DZIAŁA NA PORCIE 3000'));