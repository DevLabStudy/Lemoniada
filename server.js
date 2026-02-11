const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

let db = new sqlite3.Database('./lemoniada.db');

db.run(`CREATE TABLE IF NOT EXISTS zamowienia (
                                                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                  produkty TEXT,
                                                  suma TEXT,
                                                  platnosc TEXT,
                                                  godzina TEXT,
                                                  status TEXT DEFAULT 'PRZYJĘTE'
        )`);

let stanKubkow = 0;
let statusPrzerwy = false;
let powodPrzerwy = "";

app.get('/stan-magazynu', (req, res) => {
    res.json({
        kubki: stanKubkow,
        przerwa: statusPrzerwy || stanKubkow <= 0,
        powod: stanKubkow <= 0 ? "Brak kubków! Zaraz uzupełnimy." : powodPrzerwy
    });
});

app.post('/ustaw-kubki', (req, res) => {
    stanKubkow = parseInt(req.body.ilosc) || 0;
    res.json({ success: true });
});

app.post('/ustaw-przerwe', (req, res) => {
    statusPrzerwy = req.body.przerwa;
    powodPrzerwy = req.body.powod;
    res.json({ success: true });
});

app.post('/zamow', (req, res) => {
    if (stanKubkow <= 0) return res.status(400).json({ error: "Brak kubków" });
    const { produkty, suma, platnosc } = req.body;
    const godzina = new Date().toLocaleTimeString('pl-PL');
    db.run(`INSERT INTO zamowienia (produkty, suma, platnosc, godzina) VALUES (?, ?, ?, ?)`,
        [produkty, suma, platnosc, godzina], function(err) {
            stanKubkow--;
            res.json({ id: this.lastID });
        });
});

app.post('/sprzedaz-stacjonarna', (req, res) => {
    if (stanKubkow <= 0) return res.status(400).json({ error: "Brak kubków" });
    const { produkty, suma } = req.body;
    const godzina = new Date().toLocaleTimeString('pl-PL');
    db.run(`INSERT INTO zamowienia (produkty, suma, platnosc, godzina, status) VALUES (?, ?, 'Gotówka (Stacjonarna)', ?, 'WYDANE')`,
        [produkty, suma, godzina], function(err) {
            stanKubkow--;
            res.json({ success: true });
        });
});

app.get('/list-zamowienia', (req, res) => {
    db.all(`SELECT * FROM zamowienia ORDER BY id DESC`, [], (err, rows) => res.json(rows || []));
});

app.post('/update-status', (req, res) => {
    const { id, nowyStatus } = req.body;
    db.run(`UPDATE zamowienia SET status = ? WHERE id = ?`, [nowyStatus, id], () => res.json({ success: true }));
});

app.post('/reset-bazy', (req, res) => {
    db.run(`DELETE FROM zamowienia`, () => {
        db.run(`DELETE FROM sqlite_sequence WHERE name='zamowienia'`, () => res.json({ success: true }));
    });
});

app.listen(3000, '0.0.0.0', () => console.log('🚀 SERWER LEMONIADY GOTOWY'));